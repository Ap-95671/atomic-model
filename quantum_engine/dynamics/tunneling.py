"""Unitary Strang split-operator FFT on a finite periodic one-dimensional grid."""
import math
import numpy as np
from scipy.fft import fft, ifft, fftfreq


def barrier_transmission(energy, height, width):
    """Stationary plane-wave finite rectangular barrier: T, with m=ℏ=1."""
    if not all(math.isfinite(v) for v in (energy,height,width)) or min(energy,height,width)<0:
        raise ValueError("Energy, height and width must be finite and nonnegative")
    if height==0 or width==0: return 1. if energy>0 else 0.
    if energy==0:return 0.
    if abs(energy-height)<=1e-10*max(1.,height):return 1/(1+height*width**2/2)
    if energy<height:
        argument=math.sqrt(2*(height-energy))*width
        if argument>350:return 0.
        factor=math.sinh(argument)**2/(4*energy*(height-energy))
    else: factor=math.sin(math.sqrt(2*(energy-height))*width)**2/(4*energy*(energy-height))
    return 1/(1+height**2*factor)


def propagate(height=.8,width=2.,center=-35.,momentum=1.2,spread=5.,duration=60.,dt=.02,grid=1024):
    bounds={'height':(height,0,3),'width':(width,1,10),'center':(center,-60,-15),
            'momentum':(momentum,.5,3),'spread':(spread,2,8),'duration':(duration,.1,100),'dt':(dt,.005,.08)}
    for name,(value,low,high) in bounds.items():
        if not math.isfinite(value) or not low<=value<=high:
            raise ValueError(f'{name} must be finite and within {low}…{high}')
    if type(grid) is not int or grid not in (1024,2048):raise ValueError('Grid must be 1024 or 2048')
    steps=math.ceil(duration/dt)
    if steps>6000:raise ValueError('At most 6000 time steps; increase dt or reduce duration')
    if center+4*spread>=-width/2 or center-4*spread<=-85:
        raise ValueError('Initial packet must be separated from barrier and boundaries by four spreads')
    dt=duration/steps
    dx=200/grid;x=np.linspace(-100,100,grid,endpoint=False)+dx/2
    k=2*np.pi*fftfreq(grid,dx)
    inside=abs(x)<width/2
    effective_width=float(inside.sum()*dx)
    potential=np.where(inside,height,0.)
    left=x<x[inside][0];right=x>x[inside][-1]
    edge=abs(x)>85
    psi=np.exp(-(x-center)**2/(4*spread**2)+1j*momentum*x)
    psi/=np.sqrt(np.sum(abs(psi)**2)*dx)
    spectrum=abs(fft(psi,norm='ortho'))**2*dx
    reference_mean=barrier_transmission(momentum**2/2,height,effective_width)
    reference_packet=float(sum(w*barrier_transmission(float(kk*kk/2),height,effective_width)
                              for kk,w in zip(k,spectrum) if kk>0))
    half=np.exp(-.5j*potential*dt);kinetic=np.exp(-.5j*k*k*dt)
    record_steps=set(np.linspace(0,steps,min(81,steps+1),dtype=int))
    frames=[];max_drift=0.;max_boundary=0.
    stride=grid//512
    for step in range(steps+1):
        probability=abs(psi)**2*dx
        norm=float(probability.sum());boundary=float(probability[edge].sum())
        max_drift=max(max_drift,abs(norm-1));max_boundary=max(max_boundary,boundary)
        if step in record_steps:
            frames.append({'time_au':step*dt,'real':psi.real[::stride].copy(),'imag':psi.imag[::stride].copy(),
                'norm':norm,'left_probability':float(probability[left].sum()),
                'barrier_probability':float(probability[inside].sum()),'right_probability':float(probability[right].sum()),
                'boundary_probability':boundary,'mean_x_a0':float(np.sum(x*probability))})
        if step<steps:psi=half*ifft(kinetic*fft(half*psi))
    if max_drift>1e-8:raise ValueError('Propagation failed probability conservation tolerance')
    warnings=[]
    if max_boundary>1e-4:warnings.append('Packet reached the boundary zone. Periodic wrap-around contaminates later results; shorten duration or lower momentum.')
    if frames[-1]['barrier_probability']>.005 or duration<(abs(center)+4*spread)/momentum:
        warnings.append('Scattering is not fully separated. Left-region probability can still include incident amplitude; do not interpret it as a final reflection coefficient.')
    return {'model':'1D Strang split-operator FFT, rectangular barrier, periodic finite grid',
        'units':{'length':'a0','energy':'Hartree','momentum':'hbar/a0','time':'atomic time (hbar/Eh)','density':'a0^-1'},
        'parameters':{name:value for name,(value,_,_) in bounds.items()},
        'grid':grid,'dx_a0':dx,'dt_au':dt,'steps':steps,'x_a0':x[::stride],
        'potential_hartree':potential[::stride],'effective_barrier_width_a0':effective_width,
        'frames':frames,'max_norm_error':max_drift,'max_boundary_probability':max_boundary,
        'plane_wave_transmission_at_mean_energy':reference_mean,'bandwidth_averaged_reference_transmission':reference_packet,
        'warnings':warnings,
        'assumptions':'One-dimensional Gaussian wave packet with position standard deviation σ and mean momentum k. The potential is piecewise constant on grid cells; the effective sampled width is reported. Unitary second-order splitting conserves norm but has finite dt/dx error. Periodic boundaries have no absorber; boundary probability is monitored every step. Left + barrier + right probability = norm. Early left probability includes the incident packet. Stationary plane-wave transmission at mean energy differs from a finite-bandwidth packet; a positive-momentum bandwidth average is also supplied. This is not a full 3D atom.'}
