# Quantum Atom Lab 2.0 — implementation and release audit

The original 2.0 record below is preserved. Current 3.0 alpha additions and
independent numerical evidence are in [3.0 validation](QUANTUM_LAB_3_VALIDATION.md);
[current limitations](LIMITATIONS.md) and the [feature audit](FEATURE_COMPLETENESS_AUDIT.md)
supersede starting-state missing-feature descriptions.

2 November 2026 · macOS arm64 · Python 3.14.7 · Node 24.13.0.
Started from fetched `main` commit `ff99a54`, with a clean working tree.
Development branch: `feature/quantum-lab-2`. Main and the seven Pygame files
remain unchanged; no history rewrite or merge was performed.

## A. Implemented capabilities

Working foundations cover all ten requested scientific upgrade areas:

1. **Molecular orbitals:** normalized H₂⁺ 1s basis, H/S matrices, generalized
   eigenproblem, true bonding/antibonding wavefunctions and surfaces; independent
   norm/overlap/mesh tests. Ten reference occupation choices are clearly
   reference MO diagrams; O₂ has two unpaired electrons, He₂ zero covalent order.
2. **Dynamics:** exact normalized complex two-state 1D well evolution, stationary
   eigenstate check, probability/amplitude/expectation plots, playback and scrubbing.
   This is not a completed 3D atomic time-evolution engine.
3. **Spectroscopy:** initial/final quantum states and polarization, E1/spin rules,
   actual dipole integrals, vacuum photon properties, three series and a labeled
   qualitative visible-band reference. Energy differences and rates are distinct.
4. **External fields:** n=2 hydrogen weak Landé/orbital Zeeman and degenerate Stark
   Hamiltonian/state mixing. No arbitrary mesh deformation or combined-field claim.
5. **RHF:** in-house He/H₂ Gaussian integrals, Fock/density/SCF loop, convergence
   safeguards, matrices/ERIs, exact basis-space electron count and calculated density.
6. **Bonding:** H₂⁺ total electronic+nuclear curve and minimum; H₂ RHF sampled
   curve, with restricted-dissociation failure disclosed.
7. **Measurement:** reproducible Born-rule sampling, histogram/theory comparison,
   tail accounting, analytical moments and Cartesian uncertainty products.
8. **Tunneling:** bounded unitary split-operator FFT, regional probabilities,
   analytical packet reference, dt/dx checks and boundary/unfinished-scattering warnings.
9. **Spin/relativity:** valid n=2 angular-momentum coupling and g factors,
   infinite-mass point-nucleus Dirac fine splitting. Hyperfine/QED remain excluded.
10. **Geometry/DFT:** six source-preserved PubChem3D conformers and derived geometry;
    actual optional PySCF HF/PBE/B3LYP with STO-3G/6-31G, orbital/density surfaces,
    convergence, energies and same-geometry HF comparison. All six molecules and
    benzene B3LYP/6-31G ran successfully on Python 3.14.7.

Existing s/p/d/f states, real/complex harmonics, nodes, periodic table, isotopes,
ions, occupancy, overlay visibility/common scale, original energy endpoint,
classical comparison and the original Pygame program are preserved.

## B. Frontend changes

- Seven scientific navigation areas, scoped local tools and progressive disclosure.
- Reproduced 320 px horizontal overflow corrected; graphs/tables scroll locally.
- Mobile settings collapse; the compact header and tool navigation prioritize results.
- Typed shared requests, loading/error feedback, stale-response protection and timeout.
- Named native dialogs/focus return, keyboard analysis tabs, pressed states and skip link.
- Axe-discovered original label/footer contrast failures corrected.
- Seeded presets, local parameter save/restore/defaults, live guided experiments,
  model/unit-labeled viewport and graph PNG, CSV and calculation JSON exports.
- Textual scientific output remains available after WebGL initialization failure.

## C. Architecture and performance work

Scientific engines are separate from query adapters, serializers, UI controllers,
plots and Three.js. Every new lab has its own module and lifecycle. Shared
session services own revision guards/aborts, errors, presets and cleanup.

The local server bounds handlers to 16 and scientific work to two jobs. Engine
state/sample/grid/iteration limits and bounded caches prevent unbounded numerical
requests. Optional native work runs without a shell in a fixed worker module,
with whitelisted inputs and a 12-second termination timeout. No HTTP endpoint
accepts code, arbitrary filesystem paths or process commands.

Three.js rendering is on demand and suspends hidden views. Recoloring reuses
buffers; disposal includes axis textures, geometry/materials and removed lab
contexts. The atomic controller is still sizable; further decomposition can be
incremental rather than a risky full rewrite.

## D. Validation

- **80 Python scientific/API tests passed** in 9.210 s, including actual optional
  backend computations. Original baseline: 36 tests.
- **51 Chrome/Playwright tests** cover the integrated browser interface, including
  the preserved subshell overlay and six axe WCAG 2.2 AA workspace audits.
- TypeScript check and production build passed; `pip check` and `git diff --check`
  passed. Original Pygame startup, one frame and graceful exit passed with dummy SDL.
- The seven original modules were verified byte-identical to `origin/main` by Git.
- Independent checks include closed-form dipoles, NIST vacuum line comparison,
  wavefunction quadrature, Monte Carlo goodness-of-fit, well expectations, free
  Gaussian motion, barrier limits/convergence, LCAO eigenproblem/normalization,
  SCF invariants, PySCF energy/integral comparison, field limits and Dirac splitting.
- PySCF absence and timeout are tested; optional science/browser computations skip
  explicitly if the optional package is absent. The core application remains usable.

See [Scientific validation](SCIENTIFIC_VALIDATION.md) for numerical tolerances.
Automated accessibility rules do not constitute formal accessibility certification.

## E. Measurements

Original 1s peak RSS remains ~76.4 MiB; seven high 4f surfaces ~268.3 MiB.
Representative new cases: 60k measurements 23.5 ms; tunneling 46.3 ms; H₂⁺ surface
and curve 18.2 ms; H₂ RHF density and curve 255.8 ms. One optional H₂ PBE worker
used ~108.9 MiB peak RSS and 396 ms total wall time. These are serial single runs,
not total concurrent memory requirements.

The instrumented idle view issued zero drawArrays calls over 500 ms. Repeated
color/geometry changes return GPU buffer allocation near initial levels. Backend
memory and geometry timings show no material original-engine regression. Browser
load runs are cache-sensitive; no causal speedup claim is made. Full measurements
and exclusions are in [Performance](PERFORMANCE.md).

## F. GitHub and review

Repository: [Ap-95671/atomic-model](https://github.com/Ap-95671/atomic-model).
Branch comparison: [feature/quantum-lab-2 against main](https://github.com/Ap-95671/atomic-model/compare/main...feature/quantum-lab-2).
Meaningful implementation commits:

- `c2c1965` — baseline audit and actual browser captures.
- `789bd2a` — navigation, accessibility and atomic rendering reliability.
- `d9244a4` — spectroscopy and measurement.
- `ccb5dba` — exact dynamics and numerical tunneling.
- `2a9d561` — H₂⁺ calculated orbitals and total-energy curves.
- `6afc480` — independently validated RHF and density rendering.
- `6266b03` — fields/spin, reference structures/diagrams and optional DFT integration.

Release documentation/screenshots follow in a separate commit. The final chat
and pull request provide the verified remote head and review URL. No merge into
main is authorized or performed.

## G. Remaining work and limitations

The original request is broader than the implemented model scopes: full 3D atomic
time evolution, general field/spin Hamiltonians, open-shell SCF, geometry
optimization, electrostatic potential, correlated dissociation, systematic
complete-basis studies, hyperfine and QED remain unsupported. Small-basis LCAO,
RHF and finite-grid DFT results are not exact chemistry. Native cancellation is
bounded by worker timeout; core NumPy work is not interrupted mid-operation.
GPU memory/driver behavior and every browser combination are not exhaustively
verified. See [Limitations](LIMITATIONS.md); these gaps are not hidden behind
unfinished feature screens.

## Actual application captures

[Atomic 2p with nodes](quantum-lab-2-atomic.png) ·
[H₂⁺ calculated antibonding orbital](quantum-lab-2-molecular.png) ·
[Water PBE and HF comparison](quantum-lab-2-dft.png) ·
[Numerical tunneling](quantum-lab-2-tunneling.png) ·
[Mobile molecular workspace](quantum-lab-2-mobile.png).
