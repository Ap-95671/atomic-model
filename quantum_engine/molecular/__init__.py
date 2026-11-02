"""H2+ fixed-exponent 1s LCAO in atomic units; fixed point nuclei."""
from functools import lru_cache
import math
import numpy as np
from scipy.linalg import eigh
from scipy.optimize import minimize_scalar

MODEL='H2+ variational LCAO, two normalized hydrogen 1s Slater functions, fixed exponent 1'


def lcao(distance=2.):
    if not math.isfinite(distance) or not .5<=distance<=10:
        raise ValueError('Internuclear separation must be 0.5…10 a0')
    r=distance
    overlap=math.exp(-r)*(1+r+r*r/3)
    coulomb=-1/r+math.exp(-2*r)*(1+1/r)
    exchange=-math.exp(-r)*(1+r)
    h=np.array([[-.5+coulomb,-.5*overlap+exchange],[-.5*overlap+exchange,-.5+coulomb]])
    s=np.array([[1.,overlap],[overlap,1.]])
    energies,coeff=eigh(h,s)
    # Fix arbitrary eigenvector signs for reproducible phase coloring.
    for i in range(2):
        if coeff[0,i]<0:coeff[:,i]*=-1
    return {'model':MODEL,'units':{'length':'a0','energy':'Hartree'},
            'distance_a0':r,'distance_angstrom':r*.529177210544,'overlap':overlap,
            'hamiltonian_hartree':h,'overlap_matrix':s,'coefficients':coeff,
            'electronic_energies_hartree':energies,'nuclear_repulsion_hartree':1/r,
            'total_energies_hartree':energies+1/r,
            'normalization_constants':[1/math.sqrt(2*(1+overlap)),1/math.sqrt(2*(1-overlap))],
            'orthonormality':coeff.T@s@coeff,
            'residual':float(np.max(abs(h@coeff-s@coeff@np.diag(energies)))),
            'assumptions':'One electron and two fixed protons (Born–Oppenheimer), normalized unoptimized hydrogen 1s basis. Generalized eigenproblem Hc=ESc. Nuclear repulsion 1/R is included in total energy, not in the electronic Hamiltonian. This variational minimal-basis result is not the exact H2+ energy or a many-electron H2/N2/O2 solution. Nuclear motion, vibration, relativistic effects and optimized exponents are excluded.'}


def amplitude(xyz,distance,orbital='bonding'):
    d=lcao(distance)
    p=np.asarray(xyz,dtype=float)
    if p.shape[-1]!=3 or not np.all(np.isfinite(p)):raise ValueError('Finite Cartesian coordinates required')
    centers=np.array([[-distance/2,0,0],[distance/2,0,0]])
    ao=np.exp(-np.linalg.norm(p[...,None,:]-centers,axis=-1))/np.sqrt(np.pi)
    if orbital=='atomic-a':return ao[...,0]
    if orbital=='atomic-b':return ao[...,1]
    if orbital not in ('bonding','antibonding'):raise ValueError('Orbital must be bonding, antibonding, atomic-a or atomic-b')
    return ao@d['coefficients'][:,0 if orbital=='bonding' else 1]


@lru_cache(maxsize=1)
def bond_curve():
    distances=np.linspace(.5,10,121)
    data=[lcao(float(r)) for r in distances]
    optimum=minimize_scalar(lambda r:lcao(float(r))['total_energies_hartree'][0],bounds=(.5,10),method='bounded')
    if not optimum.success:raise ValueError('Bond minimum search did not converge')
    return {'distance_a0':distances,'bonding_total_hartree':[d['total_energies_hartree'][0] for d in data],
            'antibonding_total_hartree':[d['total_energies_hartree'][1] for d in data],
            'bonding_electronic_hartree':[d['electronic_energies_hartree'][0] for d in data],
            'nuclear_repulsion_hartree':1/distances,'equilibrium_a0':float(optimum.x),
            'minimum_total_hartree':float(optimum.fun),'dissociation_limit_hartree':-.5,
            'binding_energy_hartree':float(-.5-optimum.fun),'model':MODEL,'units':{'length':'a0','energy':'Hartree'}}
