"""Bounded closed-shell post-HF and response theory; optional PySCF only."""
from dataclasses import dataclass
import math
import time
import numpy as np
from scipy.constants import physical_constants, h, c, electron_volt
from .models import ChemistryRequest
from .scf import solve, build_method, Progress

HARTREE_EV=physical_constants['Hartree energy in eV'][0]

@dataclass(frozen=True)
class CorrelationOptions:
    method:str='ccsd'
    active_orbitals:int=2
    active_electrons:int=2

    @classmethod
    def parse(cls,data):
        if not isinstance(data,dict) or set(data)-{'method','active_orbitals','active_electrons'}:
            raise ValueError('Correlation options: method, active_orbitals and active_electrons only')
        value=cls(**data)
        if value.method not in ('mp2','ccsd','ccsd(t)','cisd','fci','casci','casscf'):
            raise ValueError('Unsupported correlation method')
        if type(value.active_orbitals) is not int or not 2<=value.active_orbitals<=8 or type(value.active_electrons) is not int or not 2<=value.active_electrons<=8 or value.active_electrons%2:
            raise ValueError('Active orbitals must be 2…8, active electrons even and 2…8')
        return value

@dataclass(frozen=True)
class ExcitationOptions:
    method:str='td'
    states:int=3

    @classmethod
    def parse(cls,data):
        if not isinstance(data,dict) or set(data)-{'method','states'}:
            raise ValueError('Excitation options: method and states only')
        value=cls(**data)
        if value.method not in ('td','tda') or type(value.states) is not int or not 1<=value.states<=5:
            raise ValueError('Response method must be td/tda and states 1…5')
        return value


def reference(request,progress,allow_dft=False):
    if request.spin or request.method not in (('hf','rhf','pbe','b3lyp') if allow_dft else ('hf','rhf')):
        raise ValueError('This workflow requires a closed-shell restricted reference')
    mol,method,_=build_method(request)
    if mol.nao_nr()>30 or mol.natm>5:
        raise ValueError('Advanced response/correlation jobs support at most 5 atoms and 30 basis functions')
    result,solution=solve(request,progress)
    method.kernel()
    if not method.converged:raise ValueError('Reference SCF failed')
    return result,solution,mol,method


def correlation(request:ChemistryRequest,options:CorrelationOptions,progress:Progress=lambda _:None):
    started=time.perf_counter()
    result,solution,mol,mf=reference(request,progress)
    progress({'stage':f'Computing {options.method.upper()} correlation'})
    method=options.method
    diagnostics={}
    history=[]
    triples=0.
    if method=='mp2':
        from pyscf import mp
        model=mp.MP2(mf);model.kernel()
        energy=float(model.e_tot)
        convergence='Noniterative second-order perturbation expression evaluated'
    elif method in ('ccsd','ccsd(t)'):
        from pyscf import cc
        model=cc.CCSD(mf);model.max_cycle=80;model.conv_tol=1e-9;model.conv_tol_normt=1e-7
        def callback(env):
            entry={'iteration':len(history)+1,'correlation_energy_hartree':float(env.get('eccsd',0)),
                   'amplitude_residual':float(np.linalg.norm(model.amplitudes_to_vector(env['t1new'],env['t2new'])-model.amplitudes_to_vector(env['t1'],env['t2'])))}
            history.append(entry);progress({'stage':'Coupled-cluster iterations',**entry})
        model.callback=callback;model.kernel()
        if not model.converged:raise ValueError('CCSD amplitudes did not converge')
        t1=float(np.linalg.norm(model.t1)/np.sqrt(mol.nelectron))
        diagnostics['t1_amplitude_norm_per_sqrt_electrons']=t1
        if method=='ccsd(t)':
            progress({'stage':'Perturbative triples correction'})
            triples=float(model.ccsd_t())
        energy=float(model.e_tot)+triples
        convergence='CCSD amplitudes converged; triples noniterative' if triples else 'CCSD amplitudes converged'
    elif method=='cisd':
        from pyscf import ci
        model=ci.CISD(mf);model.max_cycle=80;model.conv_tol=1e-10;model.kernel()
        if not model.converged:raise ValueError('CISD did not converge')
        energy=float(model.e_tot);convergence='CISD eigensolver converged'
    else:
        from pyscf import fci,mcscf
        ncas=mol.nao_nr() if method=='fci' else options.active_orbitals
        nelec=mol.nelectron if method=='fci' else options.active_electrons
        core=(mol.nelectron-nelec)//2
        if core<0 or core+ncas>mol.nao_nr() or nelec>2*ncas:
            raise ValueError('Active space incompatible with electrons/basis; uses contiguous frontier orbitals')
        determinants=math.comb(ncas,nelec//2)**2
        if ncas>12 or determinants>100_000:
            raise ValueError('FCI/active-space limit: 12 orbitals and 100000 determinants')
        diagnostics.update(active_orbitals=ncas,active_electrons=nelec,core_orbitals=core,determinants=determinants)
        if method=='fci':
            model=fci.FCI(mf);model.conv_tol=1e-11;model.max_cycle=100
            energy,vector=model.kernel()
            if not model.converged:raise ValueError('FCI eigensolver did not converge')
            density=model.make_rdm1(vector,ncas,mol.nelec)
        else:
            model=(mcscf.CASSCF if method=='casscf' else mcscf.CASCI)(mf,ncas,nelec)
            model.fcisolver.conv_tol=1e-11
            if method=='casscf':model.max_cycle_macro=50;model.conv_tol=1e-9
            model.kernel();energy=model.e_tot
            if not (model.converged if method=='casscf' else model.fcisolver.converged):
                raise ValueError('Active-space calculation did not converge')
            density=model.fcisolver.make_rdm1(model.ci,ncas,model.nelecas)
        occupations=np.linalg.eigvalsh(density)[::-1]
        diagnostics['active_natural_occupations']=occupations
        diagnostics['active_density_electron_error']=float(abs(np.trace(density)-nelec))
        if diagnostics['active_density_electron_error']>1e-7:raise ValueError('Active density electron-count check failed')
        energy=float(energy);convergence='Active-space eigensolver/orbital optimization converged' if method=='casscf' else 'CI eigensolver converged'
    if not np.isfinite(energy):raise ValueError('Nonfinite correlated energy')
    result['correlation']={'method':method.upper(),'reference_energy_hartree':float(mf.e_tot),'correlation_energy_hartree':energy-mf.e_tot,
                           'total_energy_hartree':energy,'triples_correction_hartree':triples,'converged':True,'convergence':convergence,
                           'diagnostics':diagnostics,'history':history,'wall_seconds':time.perf_counter()-started,
                           'basis_size':mol.nao_nr(),'integral_storage_estimate_mib':8*mol.nao_nr()**4/1024**2,
                           'assumptions':'Closed-shell nonrelativistic fixed nuclei. Correlation energy is relative to the RHF reference in this same basis; CASSCF also relaxes active orbitals. No frozen-core approximation. MP2 and CCSD(T) are not variational and can fail with near-degeneracy or stretched bonds. FCI is exact only within the chosen finite orbital basis. CASCI/CASSCF use a user-sized contiguous frontier active space, not an automatically validated chemical active-space selection. Displayed orbital field is the RHF reference, not a correlated wavefunction. T1/gap diagnostics are warnings, not accuracy guarantees.'}
    solution['result']=result
    return result,solution


def excitations(request:ChemistryRequest,options:ExcitationOptions,progress:Progress=lambda _:None):
    result,solution,mol,mf=reference(request,progress,allow_dft=True)
    nocc=mol.nelectron//2
    if mol.nao_nr()<=nocc:raise ValueError('Basis has no virtual orbitals; choose a larger basis')
    dft=request.method in ('pbe','b3lyp')
    td=mf.TDA() if options.method=='tda' else mf.TDDFT() if dft else mf.TDHF()
    td.nstates=min(options.states,nocc*(mol.nao_nr()-nocc));td.singlet=True;td.conv_tol=1e-9;td.max_cycle=80
    progress({'stage':'Singlet electronic linear-response eigensolver'})
    energies,xy=td.kernel()
    if not np.all(td.converged) or not len(energies):raise ValueError('Excited-state eigensolver did not converge')
    if np.any(np.asarray(energies)<=0):raise ValueError('Nonpositive excitation: unstable or unsupported reference')
    oscillator=td.oscillator_strength(gauge='length');dipoles=td.transition_dipole()
    states=[]
    for i,(energy,(x,y)) in enumerate(zip(energies,xy)):
        progress({'stage':f'Excited state {i+1}: transition density / NTO analysis'})
        x=np.array(x,copy=True);weights=abs(x)**2;norm=float(weights.sum());contributions=[]
        for index in np.argsort(weights.ravel())[::-1][:10]:
            occupied,virtual=np.unravel_index(index,weights.shape)
            contributions.append({'occupied':int(occupied),'virtual':int(nocc+virtual),'normalized_x_weight':float(weights[occupied,virtual]/norm)})
        nto_weights,nto_coeff=td.get_nto(state=i+1,threshold=0)
        ev=float(energy)*HARTREE_EV
        states.append({'state':i+1,'excitation_hartree':float(energy),'excitation_ev':ev,
                       'total_energy_hartree':float(mf.e_tot+energy),'wavelength_nm':h*c/(ev*electron_volt)*1e9,
                       'oscillator_strength':float(oscillator[i]),'transition_dipole_au':dipoles[i],
                       'orbital_contributions':contributions,'nto_weights':nto_weights,'nto_coefficients_ao':nto_coeff,
                       'xy_metric_norm':float(2*(np.sum(abs(x)**2)-np.sum(abs(np.asarray(y))**2)))})
    result['excitations']={'method':('TDA-TDDFT' if dft else 'CIS / TDA-HF') if options.method=='tda' else 'TDDFT' if dft else 'TDHF',
                           'spin':'singlet','states':states,'ground_energy_hartree':float(mf.e_tot),
                           'assumptions':'Vertical singlet linear-response excitations at fixed source/user geometry. Finite-basis and functional errors remain. Orbital gaps are not used as excitation energies. Oscillator strengths use length gauge; transition dipoles are in e a0. Contributions normalize squared X amplitudes only, not exact configuration probabilities; TDHF/TDDFT include Y de-excitation amplitudes. NTOs are SVDs of transition densities (not stationary MOs); AO coefficients and pair weights are exported. The broadened spectrum uses an arbitrary Gaussian linewidth in energy, not a measured lifetime. No excited-state geometry optimization or double-excitation treatment.'}
    solution['result']=result
    return result,solution


def bond_scan(request:ChemistryRequest,progress:Progress=lambda _:None):
    if request.system!='h2' or request.basis not in ('sto-3g','6-31g','cc-pvdz') or request.spin:
        raise ValueError('Correlated bond scan supports singlet H2 only')
    points=[]
    for index,distance in enumerate((.9,1.4,2.,3.,4.,6.)):
        progress({'stage':'H2 correlated bond scan','iteration':index+1,'distance_a0':distance})
        q=ChemistryRequest(system='h2',basis=request.basis,distance=distance,quality='preview')
        base,solution=correlation(q,CorrelationOptions(method='fci'))
        mp2,_=correlation(q,CorrelationOptions(method='mp2'))
        uhf,_=solve(ChemistryRequest(system='h2',basis=request.basis,distance=distance,method='uhf',guess='broken-symmetry'))
        points.append({'distance_a0':distance,'rhf':base['total_energy_hartree'],'fci':base['correlation']['total_energy_hartree'],
                       'mp2':mp2['correlation']['total_energy_hartree'],'uhf':uhf['total_energy_hartree'],'uhf_spin_squared':uhf['spin_squared']})
    result,solution=solve(request)
    result['bond_scan']={'points':points,'note':'All methods use the same finite basis and fixed nuclei. RHF has the wrong neutral-fragment dissociation limit; broken-symmetry UHF lowers it with spin contamination. FCI handles static correlation within this basis. MP2 can diverge as the RHF gap closes. UHF does not recover general correlation. No curve interpolant is a computed stationary-point search.'}
    solution['result']=result
    return result,solution
