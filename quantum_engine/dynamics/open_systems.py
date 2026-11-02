"""Constant-coefficient qubit Lindblad generator, matrix exponential evolution."""
import math
import numpy as np
from scipy.linalg import expm

I=np.eye(2,dtype=complex)
X=np.array([[0,1],[1,0]],dtype=complex)
Y=np.array([[0,-1j],[1j,0]],dtype=complex)
Z=np.diag([1.,-1.]).astype(complex)


def lindblad(omega=1.,drive=.5,relaxation=.2,dephasing=.1,theta=90.,phi=0.,bloch_radius=1.,duration=10.,samples=201):
    bounds={'omega':(-5,5),'drive':(0,5),'relaxation':(0,2),'dephasing':(0,2),'theta':(0,180),'phi':(-180,180),'bloch_radius':(0,1),'duration':(.1,20)}
    values=locals().copy()
    for name,(lo,hi) in bounds.items():
        v=values[name]
        if type(v) not in (int,float) or not math.isfinite(v) or not lo<=v<=hi:raise ValueError(f'{name} must be finite within {lo}…{hi}')
    if type(samples) is not int or not 21<=samples<=401:raise ValueError('samples must be 21…401')
    polar,azimuth=np.radians([theta,phi]);n=np.array([np.sin(polar)*np.cos(azimuth),np.sin(polar)*np.sin(azimuth),np.cos(polar)])
    rho=(I+bloch_radius*sum(v*s for v,s in zip(n,(X,Y,Z))))/2
    hamiltonian=(omega*Z+drive*X)/2
    collapse=[np.sqrt(relaxation)*np.array([[0,1],[0,0]]),np.sqrt(dephasing/2)*Z]
    generator=-1j*(np.kron(I,hamiltonian)-np.kron(hamiltonian.T,I))
    for operator in collapse:
        square=operator.conj().T@operator
        generator+=np.kron(operator.conj(),operator)-.5*np.kron(I,square)-.5*np.kron(square.T,I)
    times=np.linspace(0,duration,samples)
    # Incremental exponential is exact for the fixed generator up to roundoff.
    step=expm(generator*(times[1]-times[0]));vector=rho.ravel(order='F');frames=[]
    trace_error=hermiticity_error=0.;minimum=1.
    for time in times:
        density=vector.reshape(2,2,order='F');eigen=np.linalg.eigvalsh((density+density.conj().T)/2)
        trace_error=max(trace_error,float(abs(np.trace(density)-1)))
        hermiticity_error=max(hermiticity_error,float(np.max(abs(density-density.conj().T))))
        minimum=min(minimum,float(eigen.min()))
        positive=eigen[eigen>1e-15]
        frames.append({'time':float(time),'density_real':density.real,'density_imag':density.imag,
                       'populations':density.diagonal().real,'coherence_real':float(density[0,1].real),'coherence_imag':float(density[0,1].imag),
                       'bloch':np.array([np.trace(density@s).real for s in (X,Y,Z)]),
                       'purity':float(np.trace(density@density).real),'entropy_bits':float(-np.sum(positive*np.log2(positive)))})
        vector=step@vector
    if max(trace_error,hermiticity_error,-minimum)>1e-9:raise ValueError('Lindblad density-matrix invariants failed')
    return {'model':'Qubit constant-generator Lindblad master equation / matrix exponential','times':times,'frames':frames,
            'parameters':{k:values[k] for k in bounds},'max_trace_error':trace_error,'max_hermiticity_error':hermiticity_error,'minimum_eigenvalue':minimum,
            'assumptions':'Ideal Markovian qubit, H=(omega sigma_z+drive sigma_x)/2, hbar=1. Relaxation is |1>→|0> with rate gamma1; pure dephasing rate gamma_phi damps off-diagonal coherence. |0> has Bloch z=+1. Frequency is angular frequency per chosen time unit; rates and time use consistent arbitrary units, not a calibrated atom. No finite-temperature excitation or non-Markovian memory. Matrix-exponential evolution has roundoff error but no time-step truncation for this constant generator. Entropy is in bits; purity can increase under amplitude relaxation.'}
