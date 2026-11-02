"""SI constants from SciPy's CODATA tables. Internal lengths are in a₀."""
from scipy.constants import physical_constants, m_e, m_p, m_n, h, c, e

BOHR_RADIUS = physical_constants["Bohr radius"][0]
RYDBERG_EV = physical_constants["Rydberg constant times hc in eV"][0]
ATOMIC_MASS = physical_constants["atomic mass constant"][0]


def reduced_mass_ratio(nuclear_mass_u=None):
    """μ/mₑ; None selects an infinitely heavy nucleus."""
    if nuclear_mass_u is None:
        return 1.0
    import math
    if not math.isfinite(nuclear_mass_u) or nuclear_mass_u <= 0:
        raise ValueError("Nuclear mass must be positive")
    mass = nuclear_mass_u * ATOMIC_MASS
    return mass / (mass + m_e)


def length_scale(z=1.0, nuclear_mass_u=None):
    """Effective Bohr length in units of a₀."""
    import math
    if not math.isfinite(z) or z <= 0:
        raise ValueError("Coulomb charge must be positive and finite")
    return 1.0 / (z * reduced_mass_ratio(nuclear_mass_u))
