from dataclasses import dataclass
from numbers import Integral

FAMILIES = "spdf"
REAL_NAMES = {
    0: {0: "s"},
    1: {-1: "pᵧ", 0: "p_z", 1: "pₓ"},
    2: {-2: "d_xy", -1: "d_yz", 0: "d_z²", 1: "d_xz", 2: "d_x²−y²"},
    3: {-3: "f_y(3x²−y²)", -2: "f_xyz", -1: "f_y(4z²−x²−y²)", 0: "f_z(2z²−3x²−3y²)",
        1: "f_x(4z²−x²−y²)", 2: "f_z(x²−y²)", 3: "f_x(x²−3y²)"},
}


@dataclass(frozen=True)
class QuantumState:
    n: int
    l: int
    m: int = 0
    spin: float = 0.5
    basis: str = "real"

    def __post_init__(self):
        if any(isinstance(v, bool) or not isinstance(v, Integral) for v in (self.n, self.l, self.m)):
            raise ValueError("n, l and m must be integers")
        if self.n < 1 or not 0 <= self.l < self.n or abs(self.m) > self.l:
            raise ValueError("Require n ≥ 1, 0 ≤ l < n and −l ≤ m ≤ l")
        if self.spin not in (-0.5, 0.5):
            raise ValueError("Spin must be +½ or −½")
        if self.basis not in ("real", "complex"):
            raise ValueError("Basis must be real or complex")

    @property
    def nodes(self):
        return {"radial": self.n - self.l - 1, "angular": self.l, "total": self.n - 1}

    @property
    def label(self):
        if self.basis == "real" and self.l in REAL_NAMES:
            return f"{self.n}{REAL_NAMES[self.l][self.m]}"
        return f"{self.n}{FAMILIES[self.l] if self.l < 4 else ' (l='+str(self.l)+')'} (m={self.m})"
