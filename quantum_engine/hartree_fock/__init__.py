"""Closed-shell H2/He RHF using analytic s-Gaussian integrals, in atomic units."""
from dataclasses import dataclass
from functools import lru_cache
from itertools import product
import json
import math
from pathlib import Path
import numpy as np
from scipy.linalg import eigh

BASIS_DATA=json.loads((Path(__file__).resolve().parents[2]/'data/sto-3g-h-he.json').read_text())


@dataclass
class BasisFunction:
    center: np.ndarray
    exponents: np.ndarray
    weights: np.ndarray  # includes normalized primitive prefactors


def boys0(t):
    return 1-t/3+t*t/10 if t<1e-7 else math.sqrt(math.pi/t)*math.erf(math.sqrt(t))/2


def primitive_pair(a,A,b,B):
    p=a+b;mu=a*b/p;P=(a*A+b*B)/p;ab=float(np.dot(A-B,A-B));factor=math.exp(-mu*ab)
    return p,mu,P,ab,factor


def overlap(a,A,b,B):
    p,_,_,_,f=primitive_pair(a,A,b,B)
    return f*(math.pi/p)**1.5


def kinetic(a,A,b,B):
    p,mu,_,ab,f=primitive_pair(a,A,b,B)
    return mu*(3-2*mu*ab)*f*(math.pi/p)**1.5


def attraction(a,A,b,B,centers,charges):
    p,_,P,_,f=primitive_pair(a,A,b,B)
    return -2*math.pi/p*f*sum(z*boys0(p*float(np.dot(P-C,P-C))) for z,C in zip(charges,centers))


def repulsion(a,A,b,B,c,C,d,D):
    p,_,P,_,f=primitive_pair(a,A,b,B);q,_,Q,_,g=primitive_pair(c,C,d,D)
    return 2*math.pi**2.5/(p*q*math.sqrt(p+q))*f*g*boys0(p*q/(p+q)*float(np.dot(P-Q,P-Q)))


def make_basis(centers,charges,basis):
    functions=[]
    for center,charge in zip(centers,charges):
        shell=BASIS_DATA['elements'][str(charge)]['electron_shells'][0]
        alpha=np.array(shell['exponents'],float)
        coeff=np.array(shell['coefficients'][0],float)
        weights=coeff*(2*alpha/np.pi)**.75
        if basis=='uncontracted-sto-3g':
            functions.extend(BasisFunction(center,np.array([a]),np.array([(2*a/np.pi)**.75])) for a in alpha)
        else:
            norm=sum(w*v*overlap(a,center,b,center) for a,w in zip(alpha,weights) for b,v in zip(alpha,weights))
            functions.append(BasisFunction(center,alpha,weights/math.sqrt(norm)))
    return functions


@lru_cache(maxsize=48)
def integrals(system='h2',distance=1.4,basis='sto-3g'):
    if system not in ('h2','he'):raise ValueError('RHF supports H2 or He only')
    if basis not in ('sto-3g','uncontracted-sto-3g'):raise ValueError('Unsupported basis')
    if not math.isfinite(distance) or not .5<=distance<=6:raise ValueError('H2 separation must be .5…6 a0')
    centers=np.array([[-distance/2,0,0],[distance/2,0,0]]) if system=='h2' else np.zeros((1,3))
    charges=[1,1] if system=='h2' else [2]
    functions=make_basis(centers,charges,basis);size=len(functions)
    s=np.zeros((size,size));h=np.zeros_like(s);eri=np.zeros((size,)*4)
    for i,j in product(range(size),repeat=2):
        A,B=functions[i],functions[j]
        for a,u in zip(A.exponents,A.weights):
            for b,v in zip(B.exponents,B.weights):
                s[i,j]+=u*v*overlap(a,A.center,b,B.center)
                h[i,j]+=u*v*(kinetic(a,A.center,b,B.center)+attraction(a,A.center,b,B.center,centers,charges))
    for i,j,k,l in product(range(size),repeat=4):
        A,B,C,D=[functions[m] for m in (i,j,k,l)]
        for (a,u),(b,v),(c,w),(d,y) in product(zip(A.exponents,A.weights),zip(B.exponents,B.weights),zip(C.exponents,C.weights),zip(D.exponents,D.weights)):
            eri[i,j,k,l]+=u*v*w*y*repulsion(a,A.center,b,B.center,c,C.center,d,D.center)
    return functions,s,h,eri,centers,charges


def solve(system='h2',distance=1.4,basis='sto-3g',max_iterations=100):
    if type(max_iterations) is not int or not 1<=max_iterations<=100:raise ValueError('SCF iteration limit must be 1…100')
    _,s,h,eri,centers,charges=integrals(system,distance,basis)
    if np.linalg.eigvalsh(s)[0]<1e-8:raise ValueError('Basis overlap is ill-conditioned')
    nuclear=1/distance if system=='h2' else 0.
    _,coeff=eigh(h,s);density=2*coeff[:,:1]@coeff[:,:1].T
    previous=None;history=[]
    def fock(p):return h+np.einsum('kl,ijkl->ij',p,eri)-.5*np.einsum('kl,ikjl->ij',p,eri)
    for iteration in range(1,max_iterations+1):
        f=fock(density);energies,coeff=eigh(f,s)
        candidate=2*coeff[:,:1]@coeff[:,:1].T
        delta=float(np.max(abs(candidate-density)))
        energy=float(.5*np.sum(candidate*(h+fock(candidate)))+nuclear)
        if not math.isfinite(energy):raise ValueError('SCF produced nonfinite energy')
        history.append({'iteration':iteration,'total_energy_hartree':energy,'density_change':delta})
        if previous is not None and abs(energy-previous)<1e-10 and delta<1e-8:
            density=candidate;break
        previous=energy
        density=.8*candidate+.2*density
    else:raise ValueError(f'SCF did not converge in {max_iterations} iterations; no converged result returned')
    f=fock(density);energies,coeff=eigh(f,s)
    for i in range(coeff.shape[1]):
        if coeff[np.argmax(abs(coeff[:,i])),i]<0:coeff[:,i]*=-1
    residual=float(np.max(abs(f@coeff-s@coeff@np.diag(energies))))
    idempotency=float(np.max(abs(density@s@density-2*density)))
    count=float(np.trace(density@s))
    if max(residual,idempotency,abs(count-2))>1e-7:raise ValueError('SCF invariants failed')
    return {'model':f'Restricted Hartree–Fock / {basis} / fixed point nuclei',
        'system':system,'basis':basis,'basis_size':len(s),'electron_count':count,'converged':True,
        'units':{'length':'a0','energy':'Hartree','density':'electrons/a0^3'},
        'distance_a0':distance if system=='h2' else None,'centers_a0':centers,'nuclear_charges':charges,
        'total_energy_hartree':energy,'electronic_energy_hartree':energy-nuclear,'nuclear_repulsion_hartree':nuclear,
        'orbital_energies_hartree':energies,'occupations':[2]+[0]*(len(s)-1),'coefficients':coeff,
        'overlap_matrix':s,'core_hamiltonian_hartree':h,'fock_matrix_hartree':f,'density_matrix':density,
        'electron_repulsion_integrals_hartree':eri,'orthonormality':coeff.T@s@coeff,
        'scf_history':history,'residual':residual,'density_idempotency_error':idempotency,
        'assumptions':'Two-electron closed-shell restricted Hartree–Fock, analytic s-Gaussian integrals, Born–Oppenheimer fixed point nuclei, no correlation, relativity or nuclear motion. The uncontracted option expands the same three published Gaussian exponents into independent functions; it is not a complete-basis limit or a different named standard basis. RHF dissociates H2 incorrectly because a doubly occupied spatial orbital cannot describe separated correlated radicals. Orbital energies are not total molecular energies.'}


def evaluate(result,xyz,view='density'):
    functions,_,_,_,_,_=integrals(result['system'],result['distance_a0'] or 1.4,result['basis'])
    p=np.asarray(xyz);ao=np.stack([sum(w*np.exp(-a*np.sum((p-f.center)**2,axis=-1)) for a,w in zip(f.exponents,f.weights)) for f in functions],axis=-1)
    if view=='density':return np.einsum('...i,ij,...j->...',ao,result['density_matrix'],ao)
    if view not in ('homo','lumo'):raise ValueError('View must be density, homo or lumo')
    index=0 if view=='homo' else 1
    if index>=len(functions):raise ValueError('This basis has no virtual orbital; choose the expanded basis for a LUMO')
    return ao@result['coefficients'][:,index]


@lru_cache(maxsize=2)
def energy_curve(basis='sto-3g'):
    distances=np.linspace(.6,6,31)
    results=[solve('h2',float(r),basis) for r in distances]
    totals=np.array([d['total_energy_hartree'] for d in results])
    i=int(np.argmin(totals))
    return {'distance_a0':distances,'total_energy_hartree':totals,
            'electronic_energy_hartree':[d['electronic_energy_hartree'] for d in results],
            'nuclear_repulsion_hartree':1/distances,'sampled_minimum_distance_a0':float(distances[i]),
            'sampled_minimum_energy_hartree':float(totals[i]),
            'note':'Sampled RHF curve, not optimized geometry. The restricted ansatz gives incorrect dissociation; do not use its large-R limit as two isolated H atoms.'}
