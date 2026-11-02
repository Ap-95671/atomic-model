"""Normalized Rₙₗ in a₀⁻³ᐟ², with r measured in a₀."""
import numpy as np
from scipy.special import eval_genlaguerre, gammaln, roots_genlaguerre
from scipy.integrate import quad
from .quantum_numbers import QuantumState
from .constants import length_scale


def radial(n, l, r, z=1.0, nuclear_mass_u=None):
    QuantumState(n, l)
    a = length_scale(z, nuclear_mass_u)
    r = np.asarray(r, dtype=float)
    if np.any(~np.isfinite(r)) or np.any(r < 0):
        raise ValueError("Radius must be finite and nonnegative")
    rho = 2 * r / (n * a)
    log_norm = 1.5 * np.log(2 / (n * a)) + 0.5 * (
        gammaln(n-l) - np.log(2*n) - gammaln(n+l+1))
    return np.exp(log_norm-rho/2) * rho**l * eval_genlaguerre(n-l-1, 2*l+1, rho)


def radial_nodes(n, l, z=1.0, nuclear_mass_u=None):
    QuantumState(n, l)
    if n-l-1 == 0:
        return np.array([])
    roots, _ = roots_genlaguerre(n-l-1, 2*l+1)
    return roots * n * length_scale(z, nuclear_mass_u) / 2


def radial_probability(n, l, r, z=1.0, nuclear_mass_u=None):
    return np.asarray(r)**2 * radial(n, l, r, z, nuclear_mass_u)**2


def normalization(n, l, z=1.0, nuclear_mass_u=None):
    # Integrate in scaled coordinates, which stays conditioned for high Z.
    a = length_scale(z, nuclear_mass_u)
    return quad(lambda x: float(radial_probability(n, l, x*a, z, nuclear_mass_u))*a,
                0, np.inf, epsabs=1e-9, limit=250)[0]
