"""Normalized complex Y_l^m and real tesseral harmonics (Condon–Shortley).

For real states m is a basis index: positive=cos, negative=sin. These
are superpositions of ±|m| and, except m=0, are NOT L_z eigenstates.
θ is colatitude; φ is azimuth. The global sign is conventional.
"""
import numpy as np
from scipy.special import sph_harm_y


def angular(l, m, theta, phi, basis="real"):
    from .quantum_numbers import QuantumState
    QuantumState(l+1, l, m, basis=basis)
    if basis == "complex":
        return sph_harm_y(l, m, theta, phi)
    if m == 0:
        return sph_harm_y(l, 0, theta, phi).real
    y = sph_harm_y(l, abs(m), theta, phi)
    return np.sqrt(2) * (-1)**abs(m) * (y.real if m > 0 else y.imag)
