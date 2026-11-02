# Quantum Atom Lab 3.0 alpha · implementation report

This is a set of working, tested incremental milestones. **The entire 3.0
specification is not complete.** No unavailable capability has a placeholder
success screen. Original Pygame and the unmerged 2.0 work remain preserved.

## Implemented and validated

- Real molecular selection beyond H2+, with alpha/beta HF/DFT orbitals, density
  and spin density, 18 catalog systems, 3 bases, open-shell methods and explicit
  O2 triplet diagnostics. Every calculated MO can be inspected without rerunning SCF.
- Optimized H2+ Slater exponents, normalization/integral checks and measured
  preview/balanced/high mesh errors. Reference MO diagrams remain qualitative.
- Closed-shell analytic-gradient geometry optimization, convergence histories,
  initial/final overlays, optimized bond distances/angles and exports.
- Analytic Hessian harmonic modes with rigid-motion projection, mass-metric
  normalization, frequency/mode selection and displacement playback.
- Bounded MP2/CCSD/(T)/CISD/FCI/CASCI/CASSCF calculations, diagnostics and same-basis
  RHF/UHF/MP2/FCI H2 stretching comparisons.
- Singlet TDHF/TDDFT/TDA-CIS excitation energies, oscillator strengths, transition
  dipoles, NTO pair/coefficient data and explicitly broadened spectra.
- General finite well superpositions, n≤2 3D hydrogenic spectral evolution and
  constant-generator qubit Lindblad evolution with trace/positivity checks.
- Ideal 1–5 qubit circuits, measurements/entanglement diagnostics; actual
  H2/STO-3G Jordan–Wigner mapping and doubles-unitary VQE versus exact diagonalization.
- Analytic chain/square/honeycomb tight-binding bands, reciprocal cells and DOS.
- Experimental standalone scientific SDK with bundled source data; transparent
  benchmark lookup with abstention; generated reproducible benchmarks; defined
  core/optional/browser CI, contribution, license-review and public-demo docs.

## Corrected behaviors

Compatible measurement batches now accumulate and reset without regeneration.
Failed atomic requests identify retained/stale geometry and disable obsolete
exports. New chemistry requests expose real progress/cancellation that kills
and reaps the running worker; timeout/failure never masquerades as convergence.
Optimized fields use final nuclei. SCF validates spin counts, orbital overlap,
density properties and independent total-energy decomposition. New controls,
longer JSON presets, source-link styling and adaptive default validation work.

## Validation and measured performance

Local Python 3.14.7/macOS arm64 and Node 24.13: **126 Python tests pass**
(12.837 s), **85 Chromium workflows pass** (~1.2 min), preserving all original
80/51. PySCF-unavailable simulation passes 105 and explicitly skips 21. Build,
Python compilation, pip check, installed examples and outside-checkout wheel
verification pass. Ten new axe workflows and actual desktop/mobile screenshots
supplement science/API/browser tests; they do not certify every device/state.

Independent checks include Slater integral quadrature and mesh convergence,
O2 PySCF comparison, derivative/Hessian finite differences, scalar geometry
minimization, known normal-mode count, exact two-electron correlated limits,
independent MP2/TD response identities, fragment dissociation, spectral norms/
revivals, analytic atomic dipoles, independent Bloch ODE convergence, density
invariants, quantum-gate/JW algebra, VQE/FCI agreement and tight-binding dispersions.

Representative worker calculations including fields: O2 UHF .157 s / 107.7 MiB,
water optimize+vibrations .270 s / 110.6 MiB, water CCSD .147 s / 99.7 MiB,
H2 VQE .109 s / 97.0 MiB. Cold-process latency is separately measured. Atomic
playback allocated zero new GPU buffers over 1.5 s; idle emitted zero draw calls
in 400 ms. Full raw records and limitations: `PERFORMANCE.md`, `benchmark3.json`,
`browser-audit3.json`. This is not a worst-case/concurrent/GPU-memory guarantee.

Hosted GitHub Actions on commit `caf1646` independently completed **both jobs
successfully**: core-only science/SDK wheel, and optional chemistry/build/Chrome.
Run: https://github.com/Ap-95671/atomic-model/actions/runs/41495799421 .
A subsequent report/title-only commit does not change scientific code; check
its separate run on GitHub rather than inferring CI status from an older SHA.

## Still incomplete or unsupported

General spatial 3D TDSE/laser propagation; nuclear MD; validated reaction and
transition-state workflows; broader combined fields; IR/Raman derivative
intensities; dedicated NTO surfaces; geometry import, open-shell geometry and
post-HF; real-material reference integration and periodic DFT; general-molecule
VQE/noise/hardware; generalizable accuracy routing, broad independent datasets,
held-out selection regret and calibrated uncertainty. Current lookup abstains
outside exact evidence and is not ML or a publication claim.

Named portable workspaces/full camera serialization, further atomic-controller
refactoring, chunk splitting and exhaustive driver/device testing remain.
Project license approval, stable release, PyPI publication and public production
hosting remain pending. No license has been chosen and no PR has been merged.
See `LIMITATIONS.md` and the current matrix in `FEATURE_COMPLETENESS_AUDIT.md`.

## GitHub and local app

All are open stacked PRs; review/merge remains an owner action:

| PR | Branch / target | Milestone |
| --- | --- | --- |
| [#2](https://github.com/Ap-95671/atomic-model/pull/2) | `feature/quantum-lab-2` → main | Preserved 2.0, head `e240162` |
| [#3](https://github.com/Ap-95671/atomic-model/pull/3) | `codex/quantum-lab-3-foundations` → 2.0 | Molecular/jobs/geometry/vibrations, head `addd3d6` |
| [#4](https://github.com/Ap-95671/atomic-model/pull/4) | `codex/quantum-lab-3-correlated` → foundations | Correlation/excitations, head `75df851` |
| [#5](https://github.com/Ap-95671/atomic-model/pull/5) | `codex/quantum-lab-3-dynamics` → correlated | Spectral/Lindblad physics, head `abe25cb` |
| [#6](https://github.com/Ap-95671/atomic-model/pull/6) | `codex/quantum-lab-3-quantum-models` → dynamics | Circuits/VQE/bands, head `7c594e7` |
| [#7](https://github.com/Ap-95671/atomic-model/pull/7) | `codex/quantum-lab-3-platform` → quantum-models | SDK/research baseline/CI/integration records |

Remote branch SHAs were verified with `git ls-remote`; main remains `ff99a54`
and PR #2 remains `e240162`. No force push or unrelated history rewrite. The
foundation-test addition was propagated by an ordinary branch merge, not by
rewriting published commits. All seven original Pygame modules compare unchanged.

The validated app is running at http://127.0.0.1:8765/ . Its original server was
restarted so the rebuilt frontend and new APIs agree. Actual 18-system catalog,
adaptive evidence and an O2 job (9 alpha / 7 beta electrons) were verified on
that URL. Rebuild/restart instructions are in the README and SDK docs.
