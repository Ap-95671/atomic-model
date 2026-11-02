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

## B1 — geometry and harmonic vibrations

Working Molecular Lab tools: closed-shell RHF/PBE/B3LYP local BFGS geometry
optimization, PySCF analytic nuclear gradients, and final-geometry analytic
Hessians. Workloads: 2–5 atoms, ≤50 basis functions, ≤60 geometry steps, two
shared workers and 90-second timeout. Success requires optimizer success and
maximum Cartesian gradient ≤ the requested 1e-6…1e-4 Eh/a0 threshold. Failure
returns no optimized state. Source conformers initialize polyatomic systems.

Accepted-step energies, coordinates, gradient max/RMS, final distances/angles,
initial/final common-scale structure overlay, CSV/JSON/XYZ/PNG exports are
connected. Rigid translations/rotations are projected out before mass-weighted
normal-mode analysis. Every Hessian is checked for symmetry and every mode for
mass-metric orthonormality. Mode playback updates existing meshes; magnification
and playback units are explicitly schematic. Frequencies are unscaled harmonic
predictions, with imaginary modes identified. IR/Raman derivative intensities,
isotope-resolved modes, open-shell optimizations, geometry import, saddle-point
searches and global-minimum guarantees remain unsupported.

Validation: six added Python tests and ten integrated 3.0 browser tests pass.
H2/RHF/STO-3G: E = −1.1175058851 Eh; R ≈1.3459189 a0 (0.71223 Å), maximum
final gradient 2.64e-7 Eh/a0; stretch ≈5480.7722 cm⁻¹. Independent scalar
energy minimization agrees within 2e-6 a0, tightened force tolerance preserves
the energy, and analytic Hessian columns converge against central differences
of gradients at .02/.01/.005 a0. Water has three positive normal modes and a
calculated bending angle; PBE/B3LYP gradients and Hessians run successfully.
A one-step failed optimization, unsupported spin/size, optimized-coordinate
orbital reevaluation, exports, overlays and stable canvas during playback are
exercised. Experimental H2 reference values are separately attributed to NIST;
finite-basis HF predictions are not fitted to them.

Methods: [PySCF gradients/geometry](https://pyscf.org/user/geomopt.html),
[analytic harmonic analysis](https://pyscf.org/pyscf_api_docs/pyscf.hessian.html),
[SciPy BFGS](https://docs.scipy.org/doc/scipy/reference/optimize.minimize-bfgs.html),
[NIST H2 diatomic constants](https://webbook.nist.gov/cgi/cbook.cgi?ID=C1333740&Mask=1000).
