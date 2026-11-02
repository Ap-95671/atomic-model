"""Nonrelativistic Coulomb energies; never a many-electron energy model."""
import math
from .constants import RYDBERG_EV, reduced_mass_ratio, e, h, c


def energy_ev(n, z=1, nuclear_mass_u=None):
    if isinstance(n, bool) or not isinstance(n, int) or n < 1:
        raise ValueError("n must be a positive integer")
    if not math.isfinite(z) or z <= 0:
        raise ValueError("Z must be positive and finite")
    return -RYDBERG_EV * reduced_mass_ratio(nuclear_mass_u) * z*z / (n*n)


def transition(initial, final, z=1, nuclear_mass_u=None):
    if initial == final:
        raise ValueError("Choose different initial and final levels")
    delta = energy_ev(final, z, nuclear_mass_u)-energy_ev(initial, z, nuclear_mass_u)
    frequency = abs(delta)*e/h
    return {"delta_ev": delta, "frequency_hz": frequency, "wavelength_nm": c/frequency*1e9,
            "kind": "emission" if delta < 0 else "absorption",
            "selection_rule": "Electric-dipole transitions also require Δl = ±1 and Δm = 0, ±1; n alone does not establish an allowed line."}
