# Quantum Lab 3 development validation

The 3.0 work is incremental. This file records implemented milestones, not a
claim that the entire master task is complete. Base: PR #2 `e240162`; independent
baseline reproduced 80 Python / 51 Chrome tests and build on Python 3.14.7.

## Phase A1 — computed molecule workflow and repairs

- Strict `ChemistryRequest`, optional lazy PySCF engine: all ten requested
  homonuclear diatomics, LiH, He and six PubChem conformers. Spin-aware RHF/UHF/
  ROHF, RKS/UKS PBE/B3LYP, STO-3G/6-31G/cc-pVDZ; user DFT/display grids,
  initial guesses, DIIS and max-cycle controls. All indices in each spin channel
  are available. MO fields reuse the stored converged state without another SCF.
- O2 at the explicitly unoptimized R=2.5 a0: UHF alpha/beta counts 9/7,
  <S²>≈2.003272 versus target 2; energy agrees within 1e-8 Eh with an independently
  configured PySCF UHF calculation. Spin is an input state, not a global-ground-
  state proof; contamination is displayed, and UHF does not solve correlation.
- SCF checks spin counts, CᵀSC, density idempotency and independently decomposes
  kinetic, electron–nuclear, Coulomb, exchange/XC and nuclear contributions.
  Energy components must sum within 1e-6 Eh. DIIS/nonconvergence and an H2 broken-
  symmetry initial guess are exercised. All eleven diatomics converge in the
  covered STO-3G cases; cc-pVDZ H2 variationally lowers the HF energy.
- H2+ Slater exponent optimization uses the true zeta-dependent kinetic and
  Coulomb integrals, not a rescaled fixed-energy surface. At R=2 a0: zeta≈1.238698,
  Etotal≈−0.58650599 Eh. Norm and energy are checked by independent cylindrical
  quadrature; the derivative at the optimum is checked independently by finite
  differences. The optimized common basis remains limited (no polarization).
- H2+ measured maximum mesh amplitude residuals at R=2, threshold .12:
  preview 41³: 1.507%; balanced 65³: .625%; high 97³: .288%. These are vertex
  interpolation errors relative to the extracted amplitude, not probabilities.
- POST/GET/DELETE jobs: two compute slots shared with legacy requests; progress,
  90-second process timeout, actual kill/reap on cancel, bounded result/solution
  caches and scratch cleanup. Field jobs cannot change stored geometry/method.
  Tests terminate a real running worker, check failed/timed-out states, and verify
  resources/capacity are released before terminal status becomes observable.
- Measurement batches accumulate only compatible prepared states. Histograms,
  tail counts and radial means combine with correct sample weighting. Reset
  makes zero samples, preserving theory; limits are 1e6 outcomes / 1000 batches.
- Atomic calculation/species failures explicitly identify retained/stale results;
  image export stays disabled until a new complete result exists.

Evidence: `tests/test_chemistry_jobs.py`, `tests/test_job_api.py`,
`frontend/tests/chemistry3.spec.ts`, plus the preserved regression suites.
Milestone validation: **91 Python tests passed in 10.440 s; 59 Chromium tests
passed in 44.2 s** (all original 80 / 51 preserved). TypeScript and production
build passed; JavaScript 646.03 kB / 174.24 kB gzip, CSS 35.36 / 8.95 kB gzip.
Upstream PySCF temporary-file and scikit-image NumPy deprecation warnings
remain visible; they are not suppressed or treated as passing scientific checks.

Primary method reference: https://pyscf.org/user/scf.html . No core dependency or
Python downgrade is required. Optional package behavior remains explicit.
