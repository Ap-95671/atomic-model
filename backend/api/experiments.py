"""Typed-by-construction query adapters; no HTTP or rendering in the engine."""
from quantum_engine import QuantumState
from quantum_engine.spectroscopy import electric_dipole, spectral_series
from quantum_engine.measurement import measurement


def state(q, prefix="", basis="complex", defaults=(3, 1, 0)):
    def value(key, default, cast=int):
        return cast(q.get(prefix+key, [str(default)])[0])
    return QuantumState(value("n", defaults[0]), value("l", defaults[1]),
                        value("m", defaults[2]), value("spin", .5, float), basis)


def calculate(path, q, atom):
    if not atom["one_electron"]:
        raise ValueError("This laboratory requires a one-electron species, such as H or He+")
    z, mass = atom["z"], atom["nuclear_mass_u"]
    if path == "/api/spectroscopy":
        return {"transition": electric_dipole(state(q, "i_"), state(q, "f_", defaults=(2, 0, 0)),
                    z, mass, q.get("polarization", ["all"])[0]),
                "series": spectral_series(int(q.get("lower", ["2"])[0]), z, mass)}
    if path == "/api/spectroscopy/transition":
        return electric_dipole(state(q, "i_"), state(q, "f_", defaults=(2, 0, 0)),
                              z, mass, q.get("polarization", ["all"])[0])
    if path == "/api/spectroscopy/series":
        return spectral_series(int(q.get("lower", ["2"])[0]), z, mass)
    if path == "/api/measurement":
        return measurement(state(q, basis=q.get("basis", ["real"])[0], defaults=(1, 0, 0)),
                           int(q.get("count", ["2000"])[0]), int(q.get("seed", ["42"])[0]), z, mass)
    raise ValueError("Unsupported scientific operation")
