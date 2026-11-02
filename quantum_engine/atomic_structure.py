import json
from pathlib import Path
from scipy.constants import m_e, m_p
from .constants import ATOMIC_MASS
from .electron_configuration import ELEMENTS, configuration_for

ISOTOPES = json.loads((Path(__file__).resolve().parents[1]/"data/isotopes.json").read_text())


def species(z=1, a=None, charge=0):
    if isinstance(z, bool) or not isinstance(z, int) or not 1 <= z <= 118:
        raise ValueError("Atomic number must be 1…118")
    el = ELEMENTS[z-1]
    a = el["default_a"] if a is None else a
    if isinstance(a, bool) or not isinstance(a, int) or not z <= a <= 350:
        raise ValueError("Require an integer mass number Z ≤ A ≤ 350")
    if isinstance(charge, bool) or not isinstance(charge, int) or not 0 <= z-charge <= 118:
        raise ValueError("Require 0…118 electrons")
    isotope = next((i for i in ISOTOPES[str(z)] if i["a"] == a), None)
    if isotope is None:
        isotope = {"a": a, "mass_u": None, "abundance": None, "verified": False,
            "label": "Custom schematic composition; existence and stability not verified"}
    # Atomic isotope mass minus Z electron masses; electronic binding correction
    # is neglected. For ¹H use the measured proton mass directly.
    nuclear_mass = ((isotope["mass_u"]-z*m_e/ATOMIC_MASS) if isotope["mass_u"] else float(a))
    if z == 1 and a == 1:
        nuclear_mass = m_p/ATOMIC_MASS
    return {**el, "a": a, "charge": charge, "protons": z, "neutrons": a-z,
        "electrons": z-charge, "isotope": isotope, "isotopes": ISOTOPES[str(z)],
        "nuclear_mass_u": nuclear_mass, "one_electron": z-charge == 1,
        "electronic": configuration_for(z, charge)}
