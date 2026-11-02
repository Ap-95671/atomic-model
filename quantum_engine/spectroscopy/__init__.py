"""Bounded hydrogenic E1 calculations, complex m_l basis and atomic units."""
from functools import lru_cache
import numpy as np
from numpy.polynomial.legendre import leggauss
from scipy.integrate import quad
from scipy.special import sph_harm_y
from quantum_engine.constants import length_scale, h, c, e
from quantum_engine.energy_levels import energy_ev, transition
from quantum_engine.radial_wavefunctions import radial
from quantum_engine.quantum_numbers import QuantumState

MODEL = "Nonrelativistic hydrogenic E1, reduced mass, complex m_l basis"


def validate_state(state):
    if not isinstance(state, QuantumState) or state.n > 8 or state.l > 3 or state.basis != "complex":
        raise ValueError("Spectroscopy supports complex-basis n=1…8, l=0…3")


@lru_cache(maxsize=256)
def radial_dipole(ni, li, nf, lf):
    value, error = quad(lambda r: float(radial(ni, li, r)*radial(nf, lf, r))*r**3,
                        0, np.inf, epsabs=1e-9, epsrel=1e-9, limit=200)
    if error > max(1e-7, abs(value)*1e-7):
        raise ValueError("Dipole quadrature failed to reach tolerance")
    return value


@lru_cache(maxsize=256)
def angular_dipole(li, mi, lf, mf, q):
    # <lf mf | sqrt(4π/3)Y_1^q | li mi>; exact polynomial quadrature
    # to roundoff for supported angular degrees, with periodic azimuth sum.
    u, weights = leggauss(24)
    theta = np.arccos(u)[:, None]
    phi = np.linspace(0, 2*np.pi, 48, endpoint=False)[None, :]
    operator = np.sqrt(4*np.pi/3)*sph_harm_y(1, q, theta, phi)
    product = sph_harm_y(lf, mf, theta, phi).conj()*operator*sph_harm_y(li, mi, theta, phi)
    return complex(np.sum(weights[:, None]*product)*2*np.pi/48)


def electric_dipole(initial, final, z=1, nuclear_mass_u=None, polarization="all"):
    validate_state(initial); validate_state(final)
    if polarization not in ("all", "pi", "sigma+", "sigma-"):
        raise ValueError("Polarization must be all, pi, sigma+ or sigma-")
    # Validate charge/mass even for forbidden transitions.
    scale = length_scale(z, nuclear_mass_u)
    result = transition(initial.n, final.n, z, nuclear_mass_u)
    delta_l, delta_m = final.l-initial.l, final.m-initial.m
    allowed_q = {"all": (-1, 0, 1), "pi": (0,), "sigma+": (1,), "sigma-": (-1,)}[polarization]
    spin_allowed = initial.spin == final.spin
    allowed = abs(delta_l) == 1 and delta_m in allowed_q and spin_allowed
    strengths = {str(q): 0.0 for q in (-1, 0, 1)}
    if abs(delta_l) == 1 and spin_allowed:
        rd = radial_dipole(initial.n, initial.l, final.n, final.l)*scale
        for q in allowed_q:
            if delta_m == q:
                strengths[str(q)] = float(abs(rd*angular_dipole(initial.l, initial.m, final.l, final.m, q))**2)
    return {**result, "model": MODEL,
            "units": {"energy": "eV", "wavelength": "nm in vacuum", "frequency": "Hz", "dipole_squared": "a0^2 (charge e omitted)"},
            "initial": {"n": initial.n, "l": initial.l, "m": initial.m, "spin": initial.spin},
            "final": {"n": final.n, "l": final.l, "m": final.m, "spin": final.spin},
            "polarization": polarization, "delta_l": delta_l, "delta_m": delta_m,
            "allowed": allowed, "dipole_squared_a0": sum(strengths.values()), "components_a0_squared": strengths,
            "selection_note": "E1 requires Δl=±1, Δm=q, unchanged spin. q labels the spherical operator component; emission photon helicity depends on propagation convention. Forbidden here does not exclude multiphoton or higher-multipole processes.",
            "assumptions": "Point nucleus, Coulomb Hamiltonian. No fine/hyperfine structure, QED, external field or absolute line intensity. Matrix-element magnitude squared is not a transition rate; radiation and populations also matter."}


def spectral_series(lower=2, z=1, nuclear_mass_u=None):
    if type(lower) is not int or lower not in (1, 2, 3):
        raise ValueError("Series lower n must be 1 (Lyman), 2 (Balmer) or 3 (Paschen)")
    lines = [{"upper_n": upper, "lower_n": lower, **transition(upper, lower, z, nuclear_mass_u)}
             for upper in range(lower+1, 13)]
    return {"name": {1: "Lyman", 2: "Balmer", 3: "Paschen"}[lower], "lines": lines,
            "limit_nm": (h*c/e*1e9) / abs(energy_ev(lower, z, nuclear_mass_u)),
            "model": MODEL, "units": {"wavelength": "nm in vacuum", "energy": "eV"},
            "note": "Shell energy differences, not resolved lines or intensities. An E1-allowed pair of angular states must also be specified."}
