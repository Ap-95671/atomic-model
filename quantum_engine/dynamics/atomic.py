"""Exact 3D hydrogenic bound-state superpositions, importance-weighted display."""
import math
import numpy as np
from numpy.polynomial.legendre import leggauss
from quantum_engine import QuantumState,wavefunction
from quantum_engine.probability import sample_positions


def atomic(states=((1,0,0),(2,1,0)),real=(1,1),imag=(0,0),quality='balanced',points=6000,seed=42):
    if not isinstance(states,(list,tuple)) or not 1<=len(states)<=4:raise ValueError('Choose 1…4 hydrogenic states')
    basis=[]
    for value in states:
        if not isinstance(value,(list,tuple)) or len(value)!=3 or any(type(n) is not int for n in value):raise ValueError('States must be integer [n,l,m] triples')
        state=QuantumState(*value,basis='complex')
        if state.n>2:raise ValueError('Atomic evolution currently supports n=1,2')
        basis.append(state)
    if len({tuple(v) for v in states})!=len(states):raise ValueError('Choose distinct atomic basis states')
    if not isinstance(real,(list,tuple)) or not isinstance(imag,(list,tuple)) or len(real)!=len(basis) or len(imag)!=len(basis):raise ValueError('Coefficient arrays must match states')
    if any(type(v) not in (int,float) or not math.isfinite(v) or abs(v)>10 for v in (*real,*imag)):raise ValueError('Finite coefficients within ±10 required')
    if quality not in ('preview','balanced','high') or type(points) is not int or not 1000<=points<=12000 or type(seed) is not int or not 0<=seed<=2**32-1:raise ValueError('Quality preview/balanced/high, points 1000…12000, seed 0…2³²−1')
    coefficients=np.array(real)+1j*np.array(imag);norm=float(np.sum(abs(coefficients)**2))
    if norm<1e-20:raise ValueError('At least one coefficient must be nonzero')
    coefficients/=np.sqrt(norm);prob=abs(coefficients)**2
    rng=np.random.default_rng(seed);counts=rng.multinomial(points,prob)
    xyz=np.concatenate([sample_positions(state,int(count),seed=int(rng.integers(2**32))) for state,count in zip(basis,counts) if count])
    values=np.array([wavefunction(s,xyz) for s in basis]);proposal=np.einsum('s,sp->p',prob,abs(values)**2)
    # Independent tensor-product spherical quadrature, not display-cloud estimates.
    nr={'preview':24,'balanced':48,'high':80}[quality]
    r,wr=leggauss(nr);r=(r+1)*25;wr=wr*25*r*r
    u,wu=leggauss(12);phi=np.arange(24)*2*np.pi/24
    rr,uu,pp=np.meshgrid(r,u,phi,indexing='ij')
    quad=np.stack([rr*np.sqrt(1-uu**2)*np.cos(pp),rr*np.sqrt(1-uu**2)*np.sin(pp),rr*uu],axis=-1).reshape(-1,3)
    weights=np.broadcast_to(wr[:,None,None]*wu[None,:,None]*2*np.pi/24,(nr,12,24)).ravel()
    field=np.array([wavefunction(s,quad) for s in basis])
    overlap=np.einsum('ip,p,jp->ij',field.conj(),weights,field)
    positions=np.einsum('ip,p,pk,jp->kij',field.conj(),weights,quad,field)
    energies=np.array([-.5/s.n**2 for s in basis]);period=2*np.pi/.375
    times=np.linspace(0,period,201);evolved=coefficients[None,:]*np.exp(-1j*times[:,None]*energies)
    norms=np.einsum('ti,ij,tj->t',evolved.conj(),overlap,evolved).real
    means=np.einsum('ti,kij,tj->tk',evolved.conj(),positions,evolved).real
    axis=np.linspace(-15,15,513);line=np.column_stack([np.zeros_like(axis),np.zeros_like(axis),axis]);line_values=np.array([wavefunction(s,line) for s in basis])
    return {'model':'Exact n≤2 hydrogenic spectral superposition / 3D complex eigenfunctions','states':states,
            'coefficients':[{'real':float(v.real),'imag':float(v.imag)} for v in coefficients],'energies_hartree':energies,
            'points':xyz,'basis_real':values.real,'basis_imag':values.imag,'proposal_density':proposal,'extent':18.,
            'axis_z_a0':axis,'line_basis_real':line_values.real,'line_basis_imag':line_values.imag,
            'times_au':times,'period_au':period,'expectation_xyz_a0':means,'norms':norms,
            'max_norm_error':float(np.max(abs(norms-1))),'overlap_error':float(np.max(abs(overlap-np.eye(len(basis))))),
            'position_matrices_real_a0':positions.real,'position_matrices_imag_a0':positions.imag,'quadrature_radial_points':nr,'quadrature_radius_a0':50.,
            'assumptions':'One electron, Z=1, infinite nuclear mass, nonrelativistic Coulomb eigenbasis n≤2. Exact spectral evolution within the selected states, not a spatial TDSE integrator or laser-driven calculation. Degenerate n=2 superpositions have stationary density despite evolving global phase. Independent spherical quadrature checks norm/expectations within r≤50 a0. Fixed display points sample q=Σ|c_n|²|φ_n|²; brightness weights |Ψ(t)|²/(Kq), K=number of basis states, represent time-dependent density by importance weighting, not electron trajectories. Cyclic color is complex phase; point opacity is not absolute probability. The 18 a0 camera scale does not truncate the sampled cloud.'}
