"""Exact arbitrary finite superpositions in the 1D hard-wall well."""
import math
import numpy as np


def well(states=(1,2,3,4),real=(1,1,.5,.25),imag=(0,0,0,0),length=10.,grid=257):
    if not isinstance(states,(list,tuple)) or not 1<=len(states)<=8 or any(type(n) is not int or not 1<=n<=16 for n in states) or len(set(states))!=len(states):
        raise ValueError('Choose 1…8 distinct integer well states n=1…16')
    if not isinstance(real,(list,tuple)) or not isinstance(imag,(list,tuple)) or len(real)!=len(states) or len(imag)!=len(states):
        raise ValueError('Real/imaginary coefficient arrays must match the basis states')
    if any(type(v) not in (int,float) or not math.isfinite(v) or abs(v)>10 for v in (*real,*imag)):
        raise ValueError('Coefficients must be finite numbers within ±10')
    if type(length) not in (int,float) or not math.isfinite(length) or not 2<=length<=30 or type(grid) is not int or grid not in (129,257,513):
        raise ValueError('Length must be 2…30 a0 and grid 129/257/513')
    coeff=np.array(real)+1j*np.array(imag);norm=float(np.sum(abs(coeff)**2))
    if norm<1e-20:raise ValueError('At least one coefficient must be nonzero')
    coeff=coeff/np.sqrt(norm);ns=np.array(states);energy=ns**2*np.pi**2/(2*length**2)
    x=np.linspace(0,length,grid);basis=np.sqrt(2/length)*np.sin(ns[:,None]*np.pi*x/length)
    product=basis[:,None,:]*basis[None,:,:]
    overlap=np.trapezoid(product,x,axis=-1)
    exact_x=np.eye(len(ns))*length/2
    for i,n in enumerate(ns):
        for j,m in enumerate(ns):
            if i!=j and (n+m)%2:exact_x[i,j]=-8*length*n*m/(np.pi**2*(n*n-m*m)**2)
    numerical_x=np.trapezoid(product*x,x,axis=-1)
    revival=4*length**2/np.pi;times=np.linspace(0,revival,513)
    evolved=coeff[None,:]*np.exp(-1j*times[:,None]*energy)
    means=np.einsum('ti,ij,tj->t',evolved.conj(),exact_x,evolved).real
    return {'model':'Exact finite-basis infinite-well spectral evolution','states':states,'coefficients':[{'real':float(v.real),'imag':float(v.imag)} for v in coeff],
            'input_coefficient_norm_squared':norm,'energies_hartree':energy,'x_a0':x,'basis':basis,'length_a0':length,
            'position_matrix_a0':exact_x,'revival_au':revival,'times_au':times,'expectation_x_a0':means,
            'expectation_energy_hartree':float(np.sum(abs(coeff)**2*energy)),'overlap_error':float(np.max(abs(overlap-np.eye(len(ns))))) if len(ns) else 0,
            'position_quadrature_error_a0':float(np.max(abs(numerical_x-exact_x))),
            'max_norm_error':float(np.max(abs(np.einsum('ti,ij,tj->t',evolved.conj(),overlap,evolved).real-1))),
            'assumptions':'Single particle, m=hbar=1, exact analytic stationary eigenbasis, hard walls. Finite coefficient expansion is the chosen state; no arbitrary initial-function projection error is estimated. Evolution is exact in this subspace, not a numerical time-step propagator. Quadrature diagnostics concern displayed spatial samples; increase grid quality to inspect them. Time-dependent global phase alone does not change density. All integer well levels revive after 4L²/pi atomic time units.'}
