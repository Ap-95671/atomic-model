# Experimental Python SDK · API version 1

Distribution `quantum-atom-lab==3.0.0a1`; import `quantum_atom_lab`. Tested with
Python 3.14.7. Core dependencies match `requirements.txt`; optional computation
matches `requirements-computation.txt`. No server/browser/Pygame/PySCF import is
needed for core operations. This is an alpha, not a published stable release.

```sh
.venv/bin/python -m pip install . --no-build-isolation
.venv/bin/python examples/sdk_basics.py
.venv/bin/python examples/sdk_chemistry.py  # requires optional PySCF
```

Normal installation is the tested default. `pip install -e .` can be useful for
ordinary developer environments; this managed macOS workspace marks generated
`.pth` files hidden and Python 3.14 skips them, so normal wheel installation was
used here. `python -m examples.sdk_basics` also works directly from the checkout.
No global interpreter settings or Python downgrade are needed.

```python
from quantum_atom_lab import HydrogenicOrbital, ChemistryRequest, molecular_calculation
orbital = HydrogenicOrbital(n=2, l=1, m=0, basis="real")
rho = orbital.probability_density(x=0., y=0., z=1.)  # a0^-3
psi = orbital.amplitude(x=[0., 1.], y=0., z=1.)      # NumPy broadcasting
mesh = orbital.geometry(mode="surface", quality="preview")
# Optional backend, direct synchronous call:
result = molecular_calculation(ChemistryRequest(system="h2"), "correlation", {"method":"ccsd"})
```

| Public operation | Behavior / units |
| --- | --- |
| `HydrogenicOrbital(n,l,m=0,basis='real',z=1,nuclear_mass_u=None)` | Normalized Coulomb eigenfunction; infinite mass by default, point nucleus |
| `.amplitude(x,y,z)` / `.probability_density(x,y,z)` | Cartesian a0 coordinates, psi a0^-3/2, density a0^-3; not radial P(r) |
| `.geometry(mode,quality,**options)` | Cloud/surface arrays, physical a0 scale, explicit grid/threshold assumptions; renderer independent |
| `.validate()` | Numerical radial normalization and stated model, not a universal accuracy certificate |
| `well_superposition(**parameters)` | Arbitrary finite well basis; energy Hartree, time hbar/Eh |
| `atomic_superposition(**parameters)` | n≤2 hydrogenic spectral evolution, quadrature and display samples |
| `open_system(**parameters)` | Bounded constant Lindblad generator and dimensionless qubit observables |
| `simulate_circuit(**parameters)` | Ideal 1–5 qubit state vectors, final measurements, little-endian labels |
| `tight_binding(**parameters)` | Analytic bands in eV, model lengths Å, k Å^-1, DOS per cell/spin |
| `spectroscopy_transition(initial,final,**parameters)` | Complex-basis `QuantumState` E1 dipole strengths, vacuum wavelengths |
| `molecular_calculation(request,operation,options)` | `scf`, `optimize`, `vibrations`, `correlation`, `excitations`, `bond_scan`, `vqe` within documented limits |

Scientific results contain NumPy arrays, model/assumptions and explicit field
names; they are not all JSON-native. Invalid/unconverged states raise errors.
SDK calls run synchronously in the caller process, so caller controls concurrency
and timeout. The application separately provides bounded process jobs and true
cancellation; direct SDK calls do not inherit the HTTP worker's 90-second limit.

Rebuild canonical data using `scripts/build_data.py` only when intentionally
updating sources, then `scripts/sync_package_data.py`. Packaged snapshots are
byte-checked against provenance-tracked `data/`; no online fetch is done at runtime.

```sh
.venv/bin/python -m pip wheel . --no-deps --no-build-isolation -w /tmp/qal-wheel
.venv/bin/python scripts/verify_wheel.py /tmp/qal-wheel
```

This exercises data, fields, core models and research lookup outside the checkout
and asserts that neither `backend` nor `pyscf` was imported. Project license
approval and publication are separate pending owner decisions.
