import numpy as np
from .radial_wavefunctions import radial
from .angular_wavefunctions import angular


def wavefunction(state, xyz, z=1.0, nuclear_mass_u=None):
    """Evaluate ψ on Cartesian coordinates (...,3), in a₀⁻³ᐟ²."""
    xyz = np.asarray(xyz, dtype=float)
    if xyz.ndim == 0 or xyz.shape[-1] != 3 or np.any(~np.isfinite(xyz)):
        raise ValueError("Coordinates must be finite Cartesian triples")
    r = np.linalg.norm(xyz, axis=-1)
    cos_theta = np.divide(xyz[..., 2], r, out=np.ones_like(r), where=r > 0)
    theta = np.arccos(np.clip(cos_theta, -1, 1))
    phi = np.mod(np.arctan2(xyz[..., 1], xyz[..., 0]), 2*np.pi)
    return radial(state.n, state.l, r, z, nuclear_mass_u) * angular(state.l, state.m, theta, phi, state.basis)


def density(state, xyz, z=1.0, nuclear_mass_u=None):
    return np.abs(wavefunction(state, xyz, z, nuclear_mass_u))**2
