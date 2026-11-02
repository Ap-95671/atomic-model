"""Finite, explicit model catalog and strict inputs for local chemistry jobs."""
from dataclasses import asdict, dataclass, fields
import math
from typing import Any

DIATOMICS = {
    "h2plus": ("H₂⁺", (1, 1), 1, 1), "h2": ("H₂", (1, 1), 0, 0),
    "he2": ("He₂", (2, 2), 0, 0), "li2": ("Li₂", (3, 3), 0, 0),
    "b2": ("B₂", (5, 5), 0, 2), "c2": ("C₂", (6, 6), 0, 0),
    "n2": ("N₂", (7, 7), 0, 0), "o2": ("O₂", (8, 8), 0, 2),
    "f2": ("F₂", (9, 9), 0, 0), "ne2": ("Ne₂", (10, 10), 0, 0),
    "lih": ("LiH", (3, 1), 0, 0),
}
MOLECULES = {"water": "H₂O", "ammonia": "NH₃", "methane": "CH₄",
             "carbon-dioxide": "CO₂", "carbon-monoxide": "CO", "benzene": "C₆H₆", "he": "He"}
METHODS = ("hf", "rhf", "uhf", "rohf", "pbe", "b3lyp")
BASES = ("sto-3g", "6-31g", "cc-pvdz")


def catalog() -> dict[str, Any]:
    systems = [{"id": key, "label": label, "charge": charge, "spin": spin,
                "diatomic": True, "distance": 1.4 if key == "h2" else 2.0 if key == "h2plus" else 2.5}
               for key, (label, _, charge, spin) in DIATOMICS.items()]
    systems += [{"id": key, "label": label, "charge": 0, "spin": 0, "diatomic": False, "distance": 1.4}
                for key, label in MOLECULES.items()]
    return {"systems": systems, "methods": METHODS, "bases": BASES,
            "diatomic_geometry_note": "User-controlled demonstration separation; not an optimized equilibrium geometry.",
            "optional_engine": "PySCF", "units": {"distance": "a0", "energy": "Hartree"}}


@dataclass(frozen=True)
class ChemistryRequest:
    system: str = "h2"
    method: str = "hf"
    basis: str = "sto-3g"
    distance: float = 1.4
    spin: int = 0  # Nalpha-Nbeta = 2S, not multiplicity
    view: str = "orbital"
    orbital: int = -1  # -1 selects HOMO for requested spin channel
    channel: str = "alpha"
    grid_level: int = 1
    quality: str = "balanced"
    threshold: float = .08
    guess: str = "minao"
    max_cycles: int = 100
    diis: bool = True

    @classmethod
    def parse(cls, data: Any) -> "ChemistryRequest":
        if not isinstance(data, dict):
            raise ValueError("A chemistry request must be a JSON object")
        valid = {field.name for field in fields(cls)}
        unknown = set(data)-valid
        if unknown:
            raise ValueError("Unknown chemistry fields: "+", ".join(sorted(unknown)))
        for name in ("spin", "orbital", "grid_level", "max_cycles"):
            if name in data and type(data[name]) is not int:
                raise ValueError(f"{name} must be an integer")
        for name in ("distance", "threshold"):
            if name in data and (type(data[name]) not in (int, float) or not math.isfinite(data[name])):
                raise ValueError(f"{name} must be a finite number")
        for name in ("system", "method", "basis", "view", "channel", "quality", "guess"):
            if name in data and not isinstance(data[name], str):
                raise ValueError(f"{name} must be a string")
        if "diis" in data and type(data["diis"]) is not bool:
            raise ValueError("diis must be boolean")
        request = cls(**data)
        request.validate()
        return request

    def validate(self) -> None:
        if self.system not in DIATOMICS and self.system not in MOLECULES:
            raise ValueError("Select a supported chemistry system")
        if self.method not in METHODS or self.basis not in BASES:
            raise ValueError("Unsupported method or basis")
        if not .6 <= self.distance <= 10:
            raise ValueError("Separation must be .6…10 a0")
        if not 0 <= self.spin <= 4:
            raise ValueError("spin = Nalpha-Nbeta must be 0…4")
        if self.system in DIATOMICS:
            _, zs, charge, _ = DIATOMICS[self.system]
            electrons = sum(zs)-charge
        else:
            electrons = {"water": 10, "ammonia": 10, "methane": 10, "carbon-dioxide": 22,
                         "carbon-monoxide": 14, "benzene": 42, "he": 2}[self.system]
        if self.spin > electrons or (electrons-self.spin) % 2:
            raise ValueError("Electron count and spin parity are incompatible")
        if self.method == "rhf" and self.spin:
            raise ValueError("RHF requires spin=0; choose UHF/ROHF or spin-aware DFT")
        if self.view not in ("orbital", "density", "spin-density"):
            raise ValueError("View must be orbital, density or spin-density")
        if self.channel not in ("alpha", "beta") or not -1 <= self.orbital <= 159:
            raise ValueError("Invalid orbital index or spin channel")
        if self.quality not in ("preview", "balanced", "high") or self.grid_level not in (0, 1, 3):
            raise ValueError("Unsupported display quality or DFT integration grid")
        if not .01 <= self.threshold <= .4 or not 1 <= self.max_cycles <= 100:
            raise ValueError("Threshold must be .01….4 and SCF cycles 1…100")
        if self.guess not in ("minao", "atom", "hcore", "broken-symmetry"):
            raise ValueError("Unsupported SCF initial guess")
        if self.guess == "broken-symmetry" and (self.system != "h2" or self.method != "uhf" or self.spin != 0):
            raise ValueError("Broken-symmetry guess is supported only for H2, UHF, spin=0")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
