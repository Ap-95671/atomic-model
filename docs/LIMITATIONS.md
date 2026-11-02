# Supported scope and remaining work · 3.0 alpha

Every implemented screen calculates its stated model or explicitly shows source
reference data. No missing engine is represented by successful fake output.
See `QUANTUM_LAB_3_VALIDATION.md` for actual test/reference evidence.

- Atomic Explorer remains nonrelativistic hydrogenic; many-electron Z_eff is
  illustrative. Ion/isotope uncertainty and schematic nuclei remain explicit.
  No self-consistent general atom, QED, finite nucleus or hyperfine model.
- Dynamics supports the preserved two-state well, arbitrary 1–8-state well and
  exact n≤2 3D hydrogenic spectral mixtures. No general spatial 3D TDSE,
  continuum wave packet, time-dependent external potential or laser driving.
  Atomic cloud points are fixed importance samples, not trajectories.
- Tunneling remains a finite periodic 1D split-operator grid, with dt/dx/boundary
  diagnostics. Regional left probability includes incident amplitude until
  outgoing packets separate. Browser abort does not interrupt active core NumPy.
- H2+ has two normalized Slater 1s functions with fixed or bonding-optimized
  common exponent. This improves the basis but is not exact, polarized or a
  many-electron solution. The physical isolated-H reference and fixed-basis
  dissociation asymptote are distinct when zeta differs from one.
- Reference MO diagrams retain ordinal energies. Calculated HF/DFT orbitals
  now support alpha/beta spin and additional systems/bases; O2 uses an explicit
  chosen triplet, not a proof of its global ground state. UHF/UKS can be spin
  contaminated; orbital energies are not electronic excitation energies.
- New SCF/geometry/correlation/response/VQE workflows are optional PySCF with
  two shared worker slots and a 90-second wall limit; legacy fixed-geometry
  HF/DFT GET retains its 12-second bound. `max_memory=384` MiB is a PySCF
  workspace hint, not a hard OS memory cap. Input/basis/CI limits remain essential.
- Geometry/vibrations: closed-shell RHF/PBE/B3LYP only, 2–5 atoms, ≤50 AOs,
  analytic-gradient local BFGS; no import, open-shell optimization, global minimum
  or transition-state guarantee. Harmonic modes project rigid motion, use average
  atomic masses and are unscaled. No isotope controls or IR/Raman intensities.
  Imaginary frequencies indicate instability, not negative-energy absorption.
- Post-HF: restricted reference, ≤5 atoms / ≤30 AOs; finite CI/active spaces.
  MP2/CCSD(T) are nonvariational and can fail near degeneracy. CASCI/CASSCF use
  user-sized contiguous frontier orbitals, not chemically automatic selection.
  FCI is exact only within the chosen finite basis. UHF does not solve correlation.
- Electronic response: up to five vertical singlets; TDHF/TDDFT/TDA-CIS,
  length-gauge dipoles/strengths and NTO pair/AO data. No dedicated NTO surfaces,
  excited-geometry relaxation or general double-excitation treatment. Spectrum
  linewidth is arbitrary, not a measured lifetime. HOMO viewport is the reference.
- Lindblad model is a constant, Markovian ideal qubit with amplitude relaxation
  and pure dephasing; no finite-temperature excitation or non-Markovian memory.
  Pure/mixed-state entropy/purity are computed, not inferred from animations.
- Circuits are ideal 1–5 qubit pure state vectors, ≤32 gates, final independent
  computational-basis shots; no mid-circuit conditionals, hardware or noise.
  Molecular VQE is H2/STO-3G only; the H2-specific doubles ansatz is sufficient
  in that parity sector, with no general-molecule/quantum-advantage implication.
- Materials are analytic nearest-neighbor chain/square/honeycomb models with
  illustrative inputs; no real-material data integration, experimental band-gap
  prediction, periodic DFT or interacting solid-state calculation. DOS is a
  finite BZ histogram per cell/spin, with grid/binning artifacts.
- Adaptive selection is a transparent measured lookup on exact benchmark
  conditions. It abstains on held-out/new molecules. No generalizable predictor,
  ML, calibrated uncertainty, unseen-molecule regret or publication claim.
- Nuclear MD and verified reaction/transition-state pathways remain unimplemented.
  They need a validated force/time-integration/trajectory workflow and Hessian-
  supported stationary-point/path validation; no interpolated proxy is shipped.
- Fields remain separate weak n=2 hydrogen Stark/Zeeman and Dirac experiments.
  More general combined-field manifolds and driven 3D views are incomplete.
- Finite meshes may miss small lobes/tight cores. Thresholds are fractions of
  sampled amplitude/density peaks, not enclosed probabilities. Source PubChem
  conformers are not optimized unless that separate calculation succeeds.
- Single local presets do not yet provide named portable workspaces or full
  atomic/camera state serialization. Further atomic-controller decomposition,
  chunk splitting and all-device/GPU-state audits remain incomplete.
- Browser checks and actual screenshots cover representative Chrome workflows,
  not formal WCAG certification or proof of leak absence across drivers. No
  total concurrent/GPU memory ceiling or every expensive worst case is measured.
- SDK is an experimental local alpha with bundled data, not a stable release or
  published PyPI package. Owner license approval remains pending. No merges,
  force pushes or public production deployment are included in this work.
