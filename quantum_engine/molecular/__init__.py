"""H2+ fixed-exponent 1s LCAO in atomic units; fixed point nuclei."""
from functools import lru_cache
import math
import numpy as np
from scipy.linalg import eigh
from scipy.optimize import minimize_scalar

MODEL='H2+ variational LCAO, two normalized hydrogen 1s Slater functions, fixed exponent 1'


def lcao(distance=2., exponent=1., optimize=False):
    if not math.isfinite(distance) or not .5<=distance<=10:
        raise ValueError('Internuclear separation must be 0.5…10 a0')
    if type(optimize) is not bool or not math.isfinite(exponent) or not .3 <= exponent <= 3:
        raise ValueError('Slater exponent must be .3…3 and optimize must be boolean')
    optimization = None
    if optimize:
        fitted = minimize_scalar(lambda value: lcao(distance, float(value))['total_energies_hartree'][0],
                                 bounds=(.3,3),method='bounded',options={'xatol':1e-8})
        if not fitted.success or not math.isfinite(fitted.fun):
            raise ValueError('Slater-exponent optimization did not converge')
        exponent = float(fitted.x)
        optimization = {'converged':True,'evaluations':int(fitted.nfev),
                        'target':'bonding total energy; the same optimized basis is used for both MOs',
                        'energy_lowering_hartree':float(lcao(distance)['total_energies_hartree'][0]-fitted.fun)}
    r=distance*exponent
    overlap=math.exp(-r)*(1+r+r*r/3)
    coulomb=-1/r+math.exp(-2*r)*(1+1/r)
    exchange=-math.exp(-r)*(1+r)
    diagonal=exponent**2/2-exponent+exponent*coulomb
    off=-exponent**2/2*overlap+(2*exponent-exponent**2)*exchange
    h=np.array([[diagonal,off],[off,diagonal]])
    s=np.array([[1.,overlap],[overlap,1.]])
    energies,coeff=eigh(h,s)
    # Fix arbitrary eigenvector signs for reproducible phase coloring.
    for i in range(2):
        if coeff[0,i]<0:coeff[:,i]*=-1
    return {'model':MODEL if exponent==1 and not optimize else 'H2+ variational Slater 1s LCAO / shared exponent '+str(round(exponent,7)),
            'basis_exponent':exponent,'exponent_optimization':optimization,'units':{'length':'a0','energy':'Hartree'},
            'distance_a0':distance,'distance_angstrom':distance*.529177210544,'overlap':overlap,
            'hamiltonian_hartree':h,'overlap_matrix':s,'coefficients':coeff,
            'electronic_energies_hartree':energies,'nuclear_repulsion_hartree':1/distance,
            'total_energies_hartree':energies+1/distance,
            'normalization_constants':[1/math.sqrt(2*(1+overlap)),1/math.sqrt(2*(1-overlap))],
            'orthonormality':coeff.T@s@coeff,
            'residual':float(np.max(abs(h@coeff-s@coeff@np.diag(energies)))),
            'assumptions':'One electron and two fixed protons (Born–Oppenheimer), normalized Slater 1s basis, with the reported fixed or variationally optimized common exponent. Generalized eigenproblem Hc=ESc. Nuclear repulsion 1/R is included in total energy, not in the electronic Hamiltonian. This variational minimal-basis result is not the exact H2+ energy or a many-electron H2/N2/O2 solution. Nuclear motion, vibration, relativistic effects and higher angular/polarization functions are excluded.'}


def amplitude(xyz,distance,orbital='bonding',exponent=1.):
    d=lcao(distance,exponent)
    p=np.asarray(xyz,dtype=float)
    if p.shape[-1]!=3 or not np.all(np.isfinite(p)):raise ValueError('Finite Cartesian coordinates required')
    centers=np.array([[-distance/2,0,0],[distance/2,0,0]])
    ao=exponent**1.5*np.exp(-exponent*np.linalg.norm(p[...,None,:]-centers,axis=-1))/np.sqrt(np.pi)
    if orbital=='atomic-a':return ao[...,0]
    if orbital=='atomic-b':return ao[...,1]
    if orbital not in ('bonding','antibonding'):raise ValueError('Orbital must be bonding, antibonding, atomic-a or atomic-b')
    return ao@d['coefficients'][:,0 if orbital=='bonding' else 1]


@lru_cache(maxsize=8)
def bond_curve(exponent=1.,optimize=False):
    distances=np.linspace(.5,10,121)
    data=[lcao(float(r),exponent,optimize) for r in distances]
    optimum=minimize_scalar(lambda r:lcao(float(r),exponent,optimize)['total_energies_hartree'][0],bounds=(.5,10),method='bounded')
    if not optimum.success:raise ValueError('Bond minimum search did not converge')
    return {'distance_a0':distances,'bonding_total_hartree':[d['total_energies_hartree'][0] for d in data],
            'antibonding_total_hartree':[d['total_energies_hartree'][1] for d in data],
            'bonding_electronic_hartree':[d['electronic_energies_hartree'][0] for d in data],
            'nuclear_repulsion_hartree':1/distances,'equilibrium_a0':float(optimum.x),
            'minimum_total_hartree':float(optimum.fun),'dissociation_limit_hartree':-.5 if optimize else exponent**2/2-exponent,
            'physical_hydrogen_reference_hartree':-.5,
            'binding_energy_hartree':float(-.5-optimum.fun),'basis_exponents':[d['basis_exponent'] for d in data],'model':data[0]['model'],'units':{'length':'a0','energy':'Hartree'}}
