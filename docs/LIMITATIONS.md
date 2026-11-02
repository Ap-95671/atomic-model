# Scope and remaining work

Implemented features are operating calculations or explicitly labeled source
models. No unavailable engine is presented as a simulated success.

- Atomic Explorer retains the nonrelativistic hydrogenic model; illustrative
  many-electron Z_eff is not self-consistent screening. Neutral/ion references,
  superheavy uncertainty and isotope-existence limitations are preserved.
- Exact dynamics is a two-state **1D well**, not a 3D time-dependent atom. More
  basis terms, atomic superpositions and 3D expectation plots remain future work.
- Tunneling is a finite periodic 1D grid. dt/dx convergence and boundary warnings
  matter. Left-region probability includes incident amplitude until separated.
- H₂⁺ LCAO has fixed unit-exponent 1s functions; its ~2.493 a₀ minimum differs
  from a high-accuracy result. The basis is not a many-electron N₂/O₂ solver.
- Ten diatomic MO diagrams use reference ordinal ordering; no numeric energies
  or calculated spatial fields are claimed. Open-shell frontier levels require
  spin-dependent interpretation beyond the simple spatial labels.
- In-house RHF supports only He/H₂, s primitives and two basis choices. It lacks
  correlation, unrestricted spin and reliable H₂ dissociation. Expanding STO-3G
  primitives is not a systematic complete-basis study.
- Optional PySCF supports closed-shell HF/PBE/B3LYP and STO-3G/6-31G at fixed
  reference coordinates. DFT grid level 1, SCF tolerance, timeout and finite
  display mesh are explicit. Geometry optimization, solvent, vibrations,
  electrostatic-potential surfaces, correlated methods and open-shell O₂ SCF
  are not implemented. The core app works with PySCF uninstalled.
- The six PubChem3D structures are theoretical conformers. Their bond data are
  derived coordinates, not new measured equilibrium values. Ball sizes and
  nuclear positions/markers are schematic wherever stated.
- Fields are separate n=2 hydrogen approximations, with B≤0.05 T and |F|≤1e-5
  atomic field. No combined Stark–Zeeman or intermediate-field solver is supplied.
  Fine structure uses infinite-mass point-Coulomb Dirac energies; Lamb/QED,
  finite nucleus and hyperfine effects remain excluded.
- Finite amplitude/density thresholds are not enclosed probabilities. High-n
  atomic lobes and tight molecular core density can be under-resolved. Plots,
  basis/grid convergence and explicit model metadata are essential context.
- Core abort cancels stale display/network work, not an active NumPy operation.
  Jobs and handlers are bounded; optional worker timeout kills its subprocess.
  This loopback server is not a public multi-user deployment architecture.
- Automated checks cover stated Chrome widths and default/representative
  workflows. They do not establish formal WCAG conformance or prove the absence
  of every browser/GPU leak. Scientific uncertainty is not eliminated by tests.

Further work should deepen model accuracy and coverage before adding new
laboratory screens: 3D atomic dynamics, grid/basis studies, optimized structures,
open-shell methods and correlated dissociation are the main scientific gaps.
