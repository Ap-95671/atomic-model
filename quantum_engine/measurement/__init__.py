"""Born-rule samples of identically prepared hydrogenic states, never paths."""
import numpy as np
from numpy.polynomial.legendre import leggauss
from quantum_engine.constants import length_scale
from quantum_engine.probability import radial_cdf, sample_positions
from quantum_engine.angular_wavefunctions import angular
from quantum_engine.quantum_numbers import QuantumState


def measurement(state, count=2000, seed=42, z=1, nuclear_mass_u=None):
    if not isinstance(state, QuantumState) or state.n > 8 or state.l > 3:
        raise ValueError("Measurement supports n=1…8, l=0…3")
    if type(seed) is not int or not 0 <= seed <= 2**32-1:
        raise ValueError("Seed must be an integer from 0 to 2^32−1")
    if type(count) is not int or not 1 <= count <= 60000:
        raise ValueError("Samples per batch must be 1…60000")
    a = length_scale(z, nuclear_mass_u)
    positions = sample_positions(state, count, z, nuclear_mass_u, seed)
    radii = np.linalg.norm(positions, axis=1)
    r, cdf = radial_cdf(state.n, state.l)
    extent = float(np.interp(.999, cdf, r)*a)
    edges = np.linspace(0, extent, 61)
    counts, _ = np.histogram(radii, edges)
    probabilities = np.diff(np.interp(edges/a, r, cdf))
    mean_r = a*(3*state.n**2-state.l*(state.l+1))/2
    mean_r2 = a*a*state.n**2*(5*state.n**2+1-3*state.l*(state.l+1))/2
    u, weights = leggauss(32)
    phi = np.linspace(0, 2*np.pi, 64, endpoint=False)[None, :]
    theta = np.arccos(u)[:, None]
    density = abs(angular(state.l, state.m, theta, phi, state.basis))**2
    direction = [np.sin(theta)*np.cos(phi), np.sin(theta)*np.sin(phi), np.cos(theta)*np.ones_like(phi)]
    angular_moments = np.array([np.sum(weights[:, None]*density*d*d)*2*np.pi/64 for d in direction])
    # Momentum-space harmonics have the same |Y|² angular distribution.
    # Coulomb virial theorem gives <p²> = 1/(n a)² in atomic momentum units.
    sigma_x = np.sqrt(mean_r2*angular_moments)
    sigma_p = np.sqrt(angular_moments)/(state.n*a)
    return {"model": "Born rule for a normalized stationary hydrogenic state",
            "units": {"length": "a0", "momentum": "hbar/a0", "uncertainty_product": "hbar"},
            "state": {"n": state.n, "l": state.l, "m": state.m, "basis": state.basis},
            "count": count, "seed": seed, "edges_a0": edges, "counts": counts,
            "theory_bin_probability": probabilities, "tail_count": int(count-counts.sum()),
            "theory_tail_probability": float(1-probabilities.sum()),
            "sample_mean_r_a0": float(radii.mean()), "sample_mean_xyz_a0": positions.mean(axis=0),
            "mean_r_a0": mean_r, "sigma_r_a0": float(np.sqrt(mean_r2-mean_r**2)),
            "position_mean_xyz_a0": [0, 0, 0], "momentum_mean_xyz_au": [0, 0, 0],
            "sigma_position_xyz_a0": sigma_x, "sigma_momentum_xyz_au": sigma_p,
            "uncertainty_products_xyz_hbar": sigma_x*sigma_p, "normalization": 1.0,
            "assumptions": "Each dot is a separate preparation and position measurement. Histogram is radial P(r)=r²|R|², including the volume factor. The last 0.1% tail is reported separately. Uncertainties describe the prepared state; no simultaneously exact position and momentum are assigned. Point nucleus, nonrelativistic, spin-independent; no post-measurement time evolution."}
