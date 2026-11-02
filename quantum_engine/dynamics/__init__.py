"""Exact infinite-well superpositions; atomic units, infinite-mass particle m=1."""
import math
import numpy as np


def superposition(state_a=1, state_b=2, ar=1., ai=0., br=1., bi=0., length=10.):
    if any(type(n) is not int or not 1 <= n <= 8 for n in (state_a,state_b)):
        raise ValueError("Basis states must be integers 1…8")
    if state_a == state_b:
        raise ValueError("Choose distinct basis states; set one coefficient to zero for an eigenstate")
    if not all(math.isfinite(v) and abs(v)<=10 for v in (ar,ai,br,bi)):
        raise ValueError("Real and imaginary coefficients must be finite and within ±10")
    if not math.isfinite(length) or not 2 <= length <= 30:
        raise ValueError("Well length must be 2…30 a0")
    coeff=np.array([complex(ar,ai),complex(br,bi)])
    norm=float(np.sum(abs(coeff)**2))
    if norm<1e-20: raise ValueError("At least one coefficient must be nonzero")
    coeff/=np.sqrt(norm)
    states=np.array([state_a,state_b])
    energies=states**2*np.pi**2/(2*length**2)
    x=np.linspace(0,length,257)
    basis=np.sqrt(2/length)*np.sin(states[:,None]*np.pi*x[None,:]/length)
    xab=0. if (state_a+state_b)%2==0 else -8*length*state_a*state_b/(np.pi**2*(state_a**2-state_b**2)**2)
    period=2*np.pi/abs(energies[1]-energies[0])
    times=np.linspace(0,period,201)
    expected_x=length/2+2*np.real(coeff[0].conjugate()*coeff[1]*np.exp(-1j*(energies[1]-energies[0])*times))*xab
    return {"model":"Exact two-state infinite square well, m=1, hard walls",
            "units":{"length":"a0","energy":"Hartree","time":"atomic time (hbar/Eh)","density":"a0^-1"},
            "states":states,"coefficients":[{"real":float(v.real),"imag":float(v.imag)} for v in coeff],
            "input_coefficient_norm_squared":norm,"energies_hartree":energies,"x_a0":x,"basis":basis,
            "length_a0":length,"x_ab_a0":xab,"period_au":period,"times_au":times,
            "expectation_x_a0":expected_x,"expectation_energy_hartree":float(np.sum(abs(coeff)**2*energies)),
            "normalization":float(np.trapezoid(abs(coeff@basis)**2,x)),
            "assumptions":"One particle in a 1D infinite square well, not a Coulomb atom. Exact stationary basis with normalized complex coefficients. Ψ=Σc_n φ_n exp(−iE_n t), ℏ=m=1. Hard-wall endpoints are zero. A single eigenstate changes global phase but its density remains stationary. No numerical time stepping, environmental decoherence or measurements are included."}


def evaluate_superposition(data, time):
    if not math.isfinite(time): raise ValueError("Time must be finite")
    coefficients=np.array([complex(v['real'],v['imag']) for v in data['coefficients']])
    return (coefficients*np.exp(-1j*np.asarray(data['energies_hartree'])*time))@np.asarray(data['basis'])
