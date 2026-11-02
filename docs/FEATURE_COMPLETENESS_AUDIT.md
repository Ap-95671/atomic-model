# Feature completeness audit — Quantum Atom Lab 3.0

Audited starting point: `e240162`, fetched `feature/quantum-lab-2`; main remains
`ff99a54`. PR #2 is open/unmerged. Clean starting tree. Follow-up branch:
`codex/quantum-lab-3-foundations`, stacked on PR #2. No merge/rewrite authorized.

## Independently reproduced baseline

Python 3.14.7/macOS arm64: **80 Python tests pass in 8.783 s**, **51 installed
Chrome/Playwright tests pass in 34.6 s**; TypeScript/Vite build passes (JS 629.48
kB / 169.68 kB gzip). The chunk-size advisory remains. PySCF 2.14.0 is installed;
geomeTRIC, QuTiP, matplotlib and package-build tooling are absent. Core imports
are independent of these optional libraries. Existing original scientific/API,
responsive, export, failure, accessibility and GPU-buffer tests were actually run.
No license/contribution/package/CI files are present at the starting point.
A license decision requires the owner's approval; no license is selected here.

Status vocabulary: **Validated** = supported behavior independently exercised;
**Limited** = working approximation with intentional limits; **Partial** = part
of the requested workflow exists; **Missing** = no implementation; **Unsupported**
= current method cannot make the requested prediction. A passing test is evidence
for its covered case, not for a missing capability. P0 = correctness/preservation;
P1 = finish existing workflows; P2 = next scientific milestone; P3 = later phase.

## Existing implementation matrix (before 3.0 edits)

| Feature | Status / actual behavior | Missing/correction | Assumptions | Evidence / source | Priority |
| --- | --- | --- | --- | --- | --- |
| Atomic s/p/d/f, n≤8 | Validated, real/complex normalized hydrogenic fields | Preserve; add convergence where justified | Nonrelativistic Coulomb point nucleus, reduced mass | `quantum_engine/*wavefunctions.py`, `tests/test_quantum.py` | P0 |
| Atomic density/cloud/surfaces | Limited; sampled density, finite marching-cubes meshes | Refine only with measured grid residuals | Peak-amplitude threshold is not enclosed probability | `backend/geometry.py`, science/mesh tests | P0 |
| Real/complex nodes and labels | Limited; real angular meshes, radial nodes | Complex angular meshes not provided; preserve explicit labeling | Real basis index differs from m eigenvalue | `quantum_numbers.py`, `main.ts`, angular tests | P1 |
| Overlays and common scale | Validated subshell/occupied layers, ≤8 | Preserve while extending field renderer | Separate densities, not correlated many-electron state | `main.ts`, `viewer.ts`, overlay e2e | P0 |
| Isotopes/ions/configurations | Limited reference data, correct counts | Unknown configurations remain unknown | Not an electronic/nuclear stability solver | `atomic_structure.py`, `electron_configuration.py`, API/data tests | P0 |
| Periodic search/occupancy/nuclei | Validated 118 elements, gallery, schematic particles | Preserve selection/focus and explicit schematic scale | Nuclear positions are not many-body calculations | atomic browser/data tests | P0 |
| Failed atomic recalculation | Partial: error toast; previous geometry/inspector can remain | Explicitly mark retained result as stale so it cannot be mistaken for changed controls | No new scientific result exists after failure | `main.ts:loadOrbital`, error browser test | P0 |
| H2+ LCAO | Limited; exact analytic integrals for fixed exponent 1 basis | Optimizable Slater exponent, basis/grid controls and convergence diagnostics | Variational two-function subspace, BO nuclei | `molecular/__init__.py`, `test_molecular.py` | P1 |
| Calculated molecule selector | Partial: direct Molecular Lab only H2+ | Unify real backend calculations in Molecular Lab; preserve separate reference tabs | Other diagrams cannot substitute for SCF | `labs/molecular.ts`, `optional_computation.py` | P1 |
| Other diatomic diagrams | Limited: conventional occupations for 10 cases | Add genuine calculations separately, retain reference label | Ordinal energy ordering, elementary bond order | `molecular/diagrams.py`, `test_advanced.py` | P1 |
| Open-shell O2/B2 | Unsupported in existing closed-shell backend | UHF/UKS or ROHF, spin counts, S² diagnostics; validate triplet | UHF is not exact correlation | optional backend has fixed spin=0 | P1 |
| MO browsing | Partial: HOMO/LUMO/density only | All computed orbital indices and spin channels; avoid rerunning SCF for each field | MO energies differ from excitation energies | `labs/pyscf.ts`, backend worker | P1 |
| 1D well dynamics | Limited: two complex coefficients, exact evolution | General finite basis, arbitrary normalized coefficients and phase/expectation diagnostics | 1D hard walls, not atomic TDSE | `dynamics/__init__.py`, `test_dynamics.py` | P1 |
| Atomic time dependence | Missing | Hydrogenic superpositions and calculated 3D density/phase | Spectral evolution distinct from numerical propagation | No atomic dynamics route/model | P2 |
| General 3D propagation/laser | Missing | Bounded TDSE solver, spatial/time/boundary convergence | No trajectory/global-phase substitution | Not implemented | P3 |
| Tunneling | Limited: FFT Strang, periodic domain, diagnostics | Preserve convergence; accuracy controls and useful cancel | Regional probabilities are not asymptotic R/T until separated | `dynamics/tunneling.py`, analytic/convergence tests | P0 |
| Measurement | Partial: seeded batch replaces sample | Accumulate compatible independent batches, clear/reset without regenerating, history-aware exports | Repeated preparations, Born rule | `labs/measurement.ts`, measurement science tests | P1 |
| Spectroscopy | Limited: hydrogenic E1, dipole strengths, vacuum series | More integrated levels/intensity models where validated | Matrix-element square is not absolute intensity | spectroscopy tests + NIST comparison | P2 |
| Fields/spin/fine structure | Limited: separate n=2 H perturbations/Dirac levels | Broader state manifold and calculated field-dependent 3D views | Weak field; QED/hyperfine deliberately excluded | `fields/__init__.py`, field tests | P2 |
| In-house RHF | Limited: He/H2, contracted/uncontracted s Gaussians | Improved diagnostics/DIIS/initial guesses; preserve independent integral validation | Restricted ansatz fails stretched H2 | `hartree_fock`, independent PySCF test | P1 |
| Optional DFT | Limited: HF/PBE/B3LYP, 2 bases, fixed closed-shell catalog | Spin-aware methods, extra molecules/bases, user grid/convergence controls | Fixed geometry, finite integration/display grids | actual all-six-molecule PySCF tests | P1 |
| Bond curves | Limited: H2+ min, sampled H2 RHF curve | UHF + correlated comparison; explicit reference asymptote | RHF dissociation error is methodological, not a plotting defect | molecular/RHF tests | P2 |
| Source molecular geometry | Validated six PubChem3D conformers and derived bonds/angles | Preserve provenance; optimization belongs to separate method | Conformers are not measured equilibrium structures | `structures.py`, source-coordinate tests | P0 |
| Geometry optimization | Missing | Actual gradients, history, force/step criteria, initial/final comparison | Iteration stop alone is not convergence | No optimization implementation | P2 |
| Vibrations | Missing | Mass-weighted Hessian, rigid-mode projection, normal-mode visualization | Harmonic vs measured anharmonic distinction | No Hessian/mode implementation | P2 |
| Post-HF/correlation | Missing | Validated MP2/CCSD/CASCI/FCI etc within strict resource bounds | Single-reference limits at dissociation | Optional library availability is not feature completion | P2 |
| Electronic excited states | Missing | TDHF/TDDFT, oscillator strengths and spectra | Orbital gaps are not excitation energies | No response-method route/UI | P2 |
| Reaction paths / nuclear MD | Missing | Constrained/TS diagnostics; actual forces and Verlet integration | Interpolation is not a verified reaction path | No implementation | P3 |
| Decoherence/open systems | Missing | Density-matrix/Lindblad evolution, positivity/trace, entropy | No open-system model supplied | No implementation | P3 |
| Quantum circuits/VQE | Missing | Small exact state vectors, JW Hamiltonian and variational optimization | Ideal simulation, no hardware claim | No implementation | P3 |
| Materials/tight binding | Missing | Lattices, reciprocal cells, dispersion/DOS and reference provenance | Simple models vs periodic DFT distinct | No implementation | P3 |
| Adaptive research engine | Missing | Transparent baseline policy, diagnostics and independent benchmarks | No evidence for ML routing/novelty claim | No implementation | P3 |
| Job orchestration/cancel | Partial: bounded slots, synchronous worker, timeout | Pollable progress and real running-process cancellation/cleanup | Browser abort currently cancels display only | `server.py`, `optional_computation.py`, timeout tests | P1 |
| Saving configuration | Partial: one preset per lab | Named/portable workspace including atomic/camera state | Existing local keys must migrate safely | `labs/session.ts` | P1 |
| Charts/exports/comparison | Partial: SVG, hover titles, uneven export availability | Shared export controls, better readable scaling, deliberate comparisons | Do not compare unlike quantities | `components/plot.ts`, export tests | P1 |
| UI/accessibility | Limited: six default-screen axe checks and Chrome widths | Manual all-tool audit; keyboard/motion/device coverage as changed | Automated zero violations is not certification | 51 baseline e2e tests and actual screenshots | P0 |
| Frontend structure | Partial: modular new labs, large atomic controller/styles | Incremental extraction of atomic view/state responsibilities | Preserve functioning TS/Three.js stack | `main.ts`, `styles.css`, `viewer.ts` | P1 |
| Rendering/performance | Limited: on-demand draw, cleanup, serial benchmarks | Heavy-overlay frames, concurrency/worst-case memory profiling | No unmeasured speedup/leak-free claim | `benchmark*.py`, buffer/idle e2e | P1 |
| Python SDK / packaging | Missing | Public versioned API, installation and actual import tests | License remains owner decision | No pyproject/public package | P3 |
| CI/contributing/changelog | Missing | Reproducible CI, examples, contribution/release documentation | No automatic PyPI publication or license choice | No starting CI/contribution/license files | P2 |
| Public demo | Unsupported by present local deployment design | Document safe resource-bounded architecture before public hosting | Current loopback service is not public production | `server.py` local bind | P3 |

## Milestone evidence log

This audit describes the checked starting point. Each completed milestone below
must name actual tests and changed behavior; later phases remain missing until
implemented end to end. No placeholder laboratory pages will be added for them.

- A0: branch/PR/history checked; 80 Python + 51 browser tests and build rerun.
- A1 implementation: computed molecule selection now includes requested
  diatomics, explicit open-shell O2, spin-resolved arbitrary MO browsing and
  field-only reevaluation; H2+ exponent optimization/mesh diagnostics; true
  backend job cancellation/progress; accumulating/clearable measurements; stale
  atomic-result labels. Existing restricted/reference models remain labeled.
  Detailed evidence and final test totals: `QUANTUM_LAB_3_VALIDATION.md`.
  This does not complete the missing advanced laboratories listed above.
- B1: geometry optimization and harmonic vibrations now **Limited/validated**
  for 2–5 atom closed-shell RHF/RKS systems, with force convergence, analytic
  Hessians, mode-count/normalization checks, overlays, exports and interactive
  mode playback. Six independent science/input tests plus real browser
  geometry/failure/water-mode workflows pass. Derivative intensities, open-shell
  geometries and imports remain unsupported; see validation report.
- C1: post-HF energies, restricted singlet linear-response excited states and a
  computed same-basis H2 correlated stretching comparison are now connected and
  **Limited/validated** within explicit size/time/active-space bounds. Six added
  science/input tests and three added browser workflows pass. NTO pair data and
  coefficients are exported; dedicated NTO surfaces, open-shell post-HF and
  automatic chemical active-space selection remain unsupported/incomplete.
- D1: general finite-state well evolution, n≤2 3D hydrogenic spectral evolution
  and constant-generator qubit Lindblad dynamics are now **Limited/validated**,
  with nine new science tests and five browser workflows. General spatial TDSE,
  laser driving, reaction paths and nuclear MD remain missing. Exact spectral
  dynamics is not presented as a general spatial propagator.
