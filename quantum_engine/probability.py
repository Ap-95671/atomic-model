"""Independent probability samples, including r² dr and sinθ dθ dφ."""
from functools import lru_cache
import numpy as np
from scipy.integrate import cumulative_trapezoid
from .radial_wavefunctions import radial_probability
from .angular_wavefunctions import angular
from .constants import length_scale


@lru_cache(maxsize=64)
def radial_cdf(n, l):
    # Far-tail domain; squared spacing also resolves small inner lobes.
    r = np.linspace(0, np.sqrt(5*n*n+30), 16000)**2
    cdf = cumulative_trapezoid(radial_probability(n, l, r), r, initial=0)
    cdf /= cdf[-1]
    return r, cdf


def sample_positions(state, count=16000, z=1.0, nuclear_mass_u=None, seed=42):
    if not isinstance(count, int) or not 1 <= count <= 60000:
        raise ValueError("Point count must be between 1 and 60000")
    rng = np.random.default_rng(seed)
    radius, cdf = radial_cdf(state.n, state.l)
    r = np.interp(rng.random(count), cdf, radius) * length_scale(z, nuclear_mass_u)
    chunks = []
    needed = count
    # Addition theorem bounds every real/complex normalized harmonic.
    bound = (2*state.l+1)/(4*np.pi)
    while needed:
        size = max(256, needed*(2*state.l+2))
        cos_t = rng.uniform(-1, 1, size)
        phi = rng.uniform(0, 2*np.pi, size)
        theta = np.arccos(cos_t)
        weight = np.abs(angular(state.l, state.m, theta, phi, state.basis))**2
        keep = rng.random(size)*bound < weight
        sin_t = np.sqrt(1-cos_t[keep]**2)
        unit = np.column_stack((sin_t*np.cos(phi[keep]), sin_t*np.sin(phi[keep]), cos_t[keep]))[:needed]
        chunks.append(unit)
        needed -= len(unit)
    return np.concatenate(chunks)*r[:, None]
