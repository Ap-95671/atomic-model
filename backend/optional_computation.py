"""Optional PySCF worker: fixed methods/data, subprocess timeout, no shell input."""
from collections import OrderedDict
import threading
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
from functools import lru_cache
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
_states = OrderedDict()
_state_lock = threading.Lock()

SYSTEMS=('h2','he','water','ammonia','methane','carbon-dioxide','carbon-monoxide','benzene')


def validate(system,method,basis,view):
    if system not in SYSTEMS:raise ValueError('Unsupported closed-shell system')
    if method not in ('hf','pbe','b3lyp'):raise ValueError('Method must be hf, pbe or b3lyp')
    if basis not in ('sto-3g','6-31g'):raise ValueError('Basis must be sto-3g or 6-31g')
    if view not in ('density','homo','lumo'):raise ValueError('Field must be density, homo or lumo')


@lru_cache(maxsize=4)
def compute(system='water',method='pbe',basis='sto-3g',view='homo'):
    validate(system,method,basis,view)
    if importlib.util.find_spec('pyscf') is None:
        raise RuntimeError('Optional PySCF is not installed. Install requirements-computation.txt; the atomic and in-house RHF labs remain available.')
    env=dict(os.environ,OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1',VECLIB_MAXIMUM_THREADS='1')
    key=(system,method,basis)
    with _state_lock:
        solution=_states.get(key)
    try:
        result=subprocess.run([sys.executable,'-m','backend.optional_computation'],input=json.dumps([system,method,basis,view,solution]),
            text=True,capture_output=True,timeout=12,cwd=ROOT,env=env)
    except subprocess.TimeoutExpired as exc:raise RuntimeError('Optional computation exceeded 12 seconds and its worker was terminated. Try STO-3G or a smaller molecule.') from exc
    if result.returncode:raise RuntimeError('Optional computational worker failed; check the installed PySCF backend.')
    try:payload=json.loads(result.stdout)
    except json.JSONDecodeError as exc:raise RuntimeError('Optional backend returned invalid numerical output') from exc
    if 'error' in payload:raise ValueError(payload['error'])
    solution=payload.pop('_solution',None)
    if solution is not None:
        with _state_lock:
            _states[key]=solution;_states.move_to_end(key)
            while len(_states)>4:_states.popitem(last=False)
    return payload


def worker(system,method,basis,view,solution=None):
    validate(system,method,basis,view)
    from pyscf import gto,scf,dft
    from skimage.measure import marching_cubes
    from scipy.constants import physical_constants
    from quantum_engine.molecular.structures import structure
    bohr_angstrom=physical_constants['Bohr radius'][0]*1e10
    if system=='h2':zs=[1,1];centers=np.array([[-.7,0,0],[.7,0,0]]);geometry=None
    elif system=='he':zs=[2];centers=np.zeros((1,3));geometry=None
    else:
        geometry=structure(system);zs=geometry['atomic_numbers'];centers=geometry['coordinates_angstrom']/bohr_angstrom
        centers=centers-centers.mean(axis=0)
    mol=gto.M(atom=[(z,tuple(v)) for z,v in zip(zs,centers)],basis=basis,unit='Bohr',spin=0,charge=0,verbose=0,max_memory=256)
    mf=scf.RHF(mol) if method=='hf' else dft.RKS(mol)
    if method!='hf':mf.xc=method;mf.grids.level=1
    mf.chkfile=None
    temporary=getattr(mf,'_chkfile',None)
    if temporary is not None:temporary.close();mf._chkfile=None
    mf.conv_tol=1e-9;mf.max_cycle=80
    history=[]
    def callback(env):
        if 'e_tot' in env:history.append({'iteration':int(env.get('cycle',len(history)))+1,'total_energy_hartree':float(env['e_tot'])})
    reused=solution is not None
    if solution is None:
        mf.callback=callback;energy=float(mf.kernel())
        if not mf.converged:raise ValueError('PySCF did not converge in 80 cycles; no converged result returned')
        density=mf.make_rdm1();s=mol.intor('int1e_ovlp');electron_count=float(np.trace(density@s))
        if abs(electron_count-mol.nelectron)>1e-7:raise ValueError('PySCF electron-count check failed')
        solution={'energy':energy,'density':density.tolist(),'mo_coeff':mf.mo_coeff.tolist(),
                  'mo_occ':mf.mo_occ.tolist(),'mo_energy':mf.mo_energy.tolist(),
                  'electron_count':electron_count,'history':history}
    else:
        energy=solution['energy'];density=np.asarray(solution['density']);history=solution['history']
        mf.mo_coeff=np.asarray(solution['mo_coeff']);mf.mo_occ=np.asarray(solution['mo_occ']);mf.mo_energy=np.asarray(solution['mo_energy'])
        electron_count=solution['electron_count']
    occupied=np.where(mf.mo_occ>0)[0];index=int(occupied[-1] if view=='homo' else occupied[-1]+1)
    if view!='density' and index>=mf.mo_coeff.shape[1]:raise ValueError('No virtual orbital in selected basis')
    extent=float(np.max(abs(centers))+5)
    axis=np.linspace(-extent,extent,65);grid=np.stack(np.meshgrid(axis,axis,axis,indexing='ij'),axis=-1)
    # Evaluate in batches to avoid storing the whole AO grid for larger bases.
    points=grid.reshape(-1,3);field=np.empty(len(points))
    for begin in range(0,len(points),8192):
        ao=mol.eval_gto('GTOval_sph',points[begin:begin+8192])
        field[begin:begin+len(ao)]=np.einsum('pi,ij,pj->p',ao,density,ao) if view=='density' else ao@mf.mo_coeff[:,index]
    field=field.reshape(grid.shape[:-1]);level=float(np.max(abs(field))*.08);surfaces=[]
    for sign in (1,-1):
        if (field*sign).max()<=level:continue
        vertices,faces,_,_=marching_cubes(field*sign,level,spacing=(axis[1]-axis[0],)*3);vertices-=extent
        surfaces.append({'vertices':vertices,'faces':faces,'phases':np.full(len(vertices),0 if sign==1 else np.pi)})
    return {'_solution':solution,'scf_reused':reused,'model':f'PySCF {__import__("pyscf").__version__} / {method.upper()} / {basis} / fixed geometry',
        'units':{'energy':'Hartree','length':'a0','density':'electrons/a0^3'},'system':system,'method':method,'basis':basis,'basis_size':mol.nao,
        'total_energy_hartree':energy,'nuclear_repulsion_hartree':float(mol.energy_nuc()),'electron_count':electron_count,
        'converged':True,'scf_history':history,'orbital_energies_hartree':mf.mo_energy,'occupations':mf.mo_occ,
        'homo_index':int(occupied[-1]),'lumo_index':int(occupied[-1]+1) if occupied[-1]+1<mol.nao else None,
        'view':view,'extent':extent,'points':[],'phases':[],'surfaces':surfaces,'centers_a0':centers,'geometry':geometry,
        'surface_note':'65³ finite grid; isosurface at 8% of sampled peak density or orbital amplitude, not enclosed probability. Tight core density and weak outer lobes can be under-resolved. DFT integration grid level 1; compare basis/grid convergence before quantitative use.',
        'assumptions':'Optional closed-shell PySCF backend, spin-restricted HF or Kohn–Sham DFT (PBE/B3LYP), point nuclei and fixed reference coordinates. No geometry optimization, vibrational correction, correlated wavefunction or exact-solution claim. Different methods/bases define different approximations; total energies are not orbital energies. No electrostatic-potential surface is implemented. A 12-second process timeout bounds requests; client cancellation prevents stale display but an active worker can finish until timeout.'}


if __name__=='__main__':
    try:
        payload=worker(*json.loads(sys.stdin.read(2_000_000)))
        print(json.dumps(payload,allow_nan=False,default=lambda x:x.tolist() if isinstance(x,np.ndarray) else x.item(),separators=(',',':')))
    except Exception as exc:print(json.dumps({'error':str(exc)}))
