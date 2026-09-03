import math


# ------------------------------------------------
# FUNDAMENTAL PHYSICAL CONSTANTS
# ------------------------------------------------

# Coulomb constant
K = 8.9875517923e9

# Elementary charge
E_CHARGE = 1.602176634e-19

# Electron mass
ELECTRON_MASS = 9.1093837015e-31

# Reduced Planck constant
HBAR = 1.054571817e-34

# Bohr radius
BOHR_RADIUS = 5.29177210903e-11

# Electron volt conversion
EV = 1.602176634e-19


# ------------------------------------------------
# BOHR MODEL
# ------------------------------------------------

def bohr_radius(n=1):
    """
    Radius of the nth Bohr orbit for Hydrogen.
    """

    return BOHR_RADIUS * (n ** 2)


def coulomb_force(radius):
    """
    Electrostatic attraction between
    one proton and one electron.
    """

    force = (
        K
        * E_CHARGE ** 2
        / radius ** 2
    )

    return force


def electron_velocity(n=1):
    """
    Electron velocity in the nth
    Bohr orbit of Hydrogen.
    """

    radius = bohr_radius(n)

    velocity = math.sqrt(
        K
        * E_CHARGE ** 2
        /
        (ELECTRON_MASS * radius)
    )

    return velocity


def kinetic_energy(n=1):
    """
    Kinetic energy of the electron.
    """

    velocity = electron_velocity(n)

    energy = (
        0.5
        * ELECTRON_MASS
        * velocity ** 2
    )

    return energy


def potential_energy(n=1):
    """
    Electrostatic potential energy.
    """

    radius = bohr_radius(n)

    energy = (
        -K
        * E_CHARGE ** 2
        / radius
    )

    return energy


def total_energy(n=1):
    """
    Total energy:
    kinetic + potential
    """

    return (
        kinetic_energy(n)
        +
        potential_energy(n)
    )


def joules_to_ev(energy):
    """
    Convert joules to electron volts.
    """

    return energy / EV


def orbital_period(n=1):
    """
    Approximate time taken for one
    revolution in the Bohr model.
    """

    radius = bohr_radius(n)
    velocity = electron_velocity(n)

    circumference = (
        2
        * math.pi
        * radius
    )

    return circumference / velocity


# ------------------------------------------------
# INFORMATION DISPLAY
# ------------------------------------------------

def print_hydrogen_physics(n=1):

    radius = bohr_radius(n)

    force = coulomb_force(radius)

    velocity = electron_velocity(n)

    ke = kinetic_energy(n)

    pe = potential_energy(n)

    total = total_energy(n)

    period = orbital_period(n)

    print()
    print("=" * 55)
    print("HYDROGEN BOHR-MODEL PHYSICS")
    print("=" * 55)

    print(f"Energy level (n):       {n}")

    print(
        f"Orbital radius:         "
        f"{radius:.5e} m"
    )

    print(
        f"Coulomb force:          "
        f"{force:.5e} N"
    )

    print(
        f"Electron velocity:      "
        f"{velocity:.5e} m/s"
    )

    print(
        f"Kinetic energy:         "
        f"{kinetic_energy(n):.5e} J"
    )

    print(
        f"Potential energy:       "
        f"{potential_energy(n):.5e} J"
    )

    print(
        f"Total energy:           "
        f"{total:.5e} J"
    )

    print(
        f"Total energy:           "
        f"{joules_to_ev(total):.4f} eV"
    )

    print(
        f"Orbital period:         "
        f"{period:.5e} s"
    )

    print("=" * 55)
    print()