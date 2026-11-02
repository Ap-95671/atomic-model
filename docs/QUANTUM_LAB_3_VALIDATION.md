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

## C1 — correlation, electronic excitations and H2 stretching

Connected Computational Chemistry laboratories calculate MP2, CCSD, CCSD(T),
CISD, FCI and contiguous-frontier CASCI/CASSCF energies; convergence, correlation
energy, integral-storage estimate, runtime/RSS and applicable active-density/T1
diagnostics are reported. Limits: restricted closed-shell, ≤5 atoms / ≤30 AOs;
FCI/CAS ≤12 orbitals and ≤100,000 determinants; same two process slots and
90-second timeout. Active-space choice is user input, not chemically automatic.
The displayed orbital remains explicitly the RHF/RKS reference. MP2/CCSD(T)
are nonvariational and can fail for near-degeneracy; no universal accuracy claim.

TDHF/TDDFT and TDA (CIS for HF) calculate up to five vertical singlet excitations,
energies/wavelengths, length-gauge oscillator strengths and transition dipoles,
X-amplitude contributions and SVD natural-transition pair weights/AO vectors.
Spectra use a disclosed arbitrary 0.15 eV Gaussian width. No excited-state
relaxation, double-excitation guarantee or measured-lifetime inference. NTO
coefficients are exported; NTO-specific surface rendering remains incomplete.

A computed six-point H2 scan compares RHF, broken-symmetry UHF, MP2 and FCI in
the same basis. At 6 a0/STO-3G, RHF −0.64507675, UHF −0.93322735, MP2
−0.89808095, FCI −0.93340218 Eh; UHF S²≈0.9993. FCI approaches twice the
independently computed atomic-H basis energy within 3e-4 Eh. This explicitly
shows restricted dissociation error and UHF spin contamination.

Six additional Python tests pass: the two-electron FCI/CCSD/CISD/full-active-space
energies coincide (−1.137275943617 Eh at R=1.4 a0), no-virtual He limit has zero
correlation, expanded-basis FCI lowers energy, independently evaluated MP2 MO
integral expression agrees, TD response matches independent A/B-matrix
solutions, 2(X†X−Y†Y)=1, NTO weights sum to one, oscillator strengths match
2ω|μ|²/3, wavelengths match hc/E, and unsupported/oversized requests fail.
All thirteen integrated 3.0 Chromium workflows pass, including response spectrum
PNG, correlated energies/active-space errors and six-point bond comparison.

Primary methods: [PySCF MP2](https://pyscf.org/user/mp.html),
[CCSD/(T)](https://pyscf.org/user/cc.html),
[configuration interaction](https://pyscf.org/user/ci.html),
[active spaces](https://pyscf.org/user/mcscf.html),
[electronic linear response/NTOs](https://pyscf.org/user/tddft.html).

## D1 — exact multistate/atomic dynamics and Lindblad evolution

Core tools now include 1–8 distinct well states (n≤16), arbitrary complex
coefficient lists, exact position matrices, full revival, phase/density playback
and spatial-quadrature diagnostics. The original two-state workflow is preserved.
Atomic evolution uses 1–4 complex hydrogenic eigenfunctions (n≤2), exact spectral
time dependence, 3D importance-weighted density/phase samples and Cartesian
expectations from independent spherical quadrature. Display points are fixed
samples from q=Σ|c|²|φ|²; opacity ∝|Ψ|²/(Kq), not electron trajectories.
Phase and density remain distinct, including stationary degenerate mixtures.
This is not a grid TDSE integrator, laser driving or a continuum wave packet.

A constant-generator qubit Lindblad model calculates pure/mixed states,
Hamiltonian precession/drive, amplitude relaxation, pure dephasing, density
matrices, Bloch vectors, populations, coherences, purity and entropy. Matrix
exponentials preserve the exact constant-generator solution up to roundoff;
trace, Hermiticity and positivity are checked over the entire trajectory.
The time/frequency unit is explicitly chosen/arbitrary, not a calibrated atom.
No finite-temperature excitation or non-Markovian model is implied.

Nine new Python tests pass: many-state normalization/analytic means/revival,
spatial quadrature convergence, atomic quadrature convergence (preview norm
error ≈1.98e-7, balanced ≈5.1e-15), independent analytic 1s–2pz dipole,
degenerate stationary density, importance-weight bounds, Hermitian Cartesian
matrices; analytic relaxation/dephasing and unitary/mixed limits; convergence
against an independently integrated Bloch ODE; density invariants/invalid input.
Five new browser workflows pass at 320/768/1440 px, including editing/errors,
atomic playback/canvas reuse, density exports and Lindblad controls. Full Python
suite at this checkpoint: **112 tests pass in 11.929 s**. These physics tools
require no PySCF or QuTiP. Broader numerical TDSE propagation, MD and reaction
pathways remain incomplete and have no placeholder screens.
