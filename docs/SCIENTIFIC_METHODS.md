# Scientific methods

All lengths use Bohr radii internally. Atomic energies in the original API
are eV; displayed photon wavelengths are explicitly vacuum nm. New APIs carry
model and unit metadata. Original hydrogenic evaluation remains unchanged.

## State-resolved spectroscopy

`quantum_engine/spectroscopy` evaluates
`⟨f|r_q|i⟩ = ∫ R_f(r) R_i(r) r³ dr × ∫ Y_f* √(4π/3)Y_1^q Y_i dΩ`.
Radial quadrature uses adaptive integration with a checked error estimate;
angular quadrature uses 24-point Gauss–Legendre and 48 periodic azimuth points.
The dimensionless Z=1 radial integral is cached and rescaled by the physical
reduced-mass Bohr length. The basis uses complex magnetic eigenstates.

E1 gates: Δl=±1, Δm=q and unchanged spin. Selected q components are summed
in squared magnitude, not coherently added. The displayed quantity is a
spatial matrix element squared (a₀²), not a photon rate or population-dependent
line intensity. Emission helicity conventions depend on propagation direction.
Same-n transitions are rejected because the implemented Coulomb energies are
degenerate and supply no nonzero photon energy.

Lyman, Balmer and Paschen plots show shell energy differences through n=12,
with equal-height markers and no intensity claim. Their series limits follow
the same reduced-mass Coulomb model. Fine/hyperfine structure, QED, broadening
and external fields are excluded.

## Born-rule measurement

`quantum_engine/measurement` reuses validated 3D inverse-CDF radial and
angular rejection sampling. Sixty radial bins extend to 99.9% probability;
the remaining tail is counted separately. Theory integrates probability over
each bin. Counts are divided by the **whole batch size** and bin width, so the
plotted portion is not silently renormalized to one.

For effective length a, analytical moments are
`⟨r⟩ = a[3n²−l(l+1)]/2` and
`⟨r²⟩ = a²n²[5n²+1−3l(l+1)]/2`.
Angular quadrature supplies `⟨u_i²⟩`. Position and momentum parity give zero
Cartesian means; `σx_i²=⟨r²⟩⟨u_i²⟩`. The Fourier-space hydrogenic harmonic
has the same angular density, and the Coulomb virial theorem gives
`σp_i²=⟨u_i²⟩/(na)²` in (ℏ/a₀)². Uncertainty products describe the prepared
ensemble, not simultaneous exact outcomes. Radial σr is explicitly separate.
Seeds allow reproducibility; independent batches use new seeds.

## References and conventions

- [NIST selection rules and line strengths](https://physics.nist.gov/Pubs/AtSpec/node17.html).
- [NIST hydrogen strong lines](https://physics.nist.gov/PhysRefData/Handbook/Tables/hydrogentable2_a.htm).
  Lyman α vacuum components: 121.566824 and 121.567364 nm. Optical wavelengths
  in that table are **air** wavelengths and must not be directly compared with
  the app's vacuum results.
- [SciPy spherical harmonics](https://docs.scipy.org/doc/scipy/reference/generated/scipy.special.sph_harm_y.html),
  polar θ, azimuth φ, Condon–Shortley phase.

Each supported laboratory carries an in-app assumptions panel. Multi-electron
atoms are rejected by these new hydrogenic APIs rather than assigned hydrogen
spectra or uncertainty predictions.

## Exact time evolution and numerical scattering

Dynamics uses two orthonormal infinite-well eigenstates
`φ_n=√(2/L) sin(nπx/L)`, `E_n=n²π²/(2L²)` and normalized complex coefficients.
The browser evaluates the exact spectral phase, with separate amplitude and
probability plots on fixed scales. Analytical `⟨x⟩` uses diagonal L/2 and
`x_ab=−8Lab/[π²(a²−b²)²]` for opposite parity (zero otherwise). This is a 1D
hard-wall model, **not time-dependent hydrogen**. One period is displayed;
playback is opt-in and its viewing rate is unrelated to physical clock time.

Tunneling uses second-order Strang splitting,
`exp(−iVdt/2) FFT⁻¹ exp(−ik²dt/2) FFT exp(−iVdt/2)`, on 1024/2048
cell-centered periodic grid points in [−100,100) a₀. Initial position standard
deviation is σ, with mean momentum k. The initial state is normalized once;
no step-by-step renormalization hides norm loss. Every step checks norm and
boundary-zone probability; the API retains at most 81 display frames and 512
spatial samples, with at most 6000 propagation steps. The full internal grid
is used for regional integrals. The actual sampled barrier width is reported.

The finite-barrier plane-wave formula uses sinh below the barrier, sin above
it and the continuous E=V limit. The packet reference averages T(k²/2) over
its positive-momentum spectral probability. Finite-time regional probability
is distinguished from asymptotic scattering. Periodic wrap-around and ongoing
barrier occupancy produce explicit warnings. A conserved norm alone does not
prove time/grid convergence.

Reference: [Feit, Fleck & Steiger, J. Computational Physics 47 (1982), 412–433](https://doi.org/10.1016/0021-9991(82)90091-2).

## H₂⁺ molecular orbitals and bonding

The two basis functions are normalized hydrogen 1s Slater orbitals on fixed
centers ±R/2. Analytical integrals:
`S=exp(−R)(1+R+R²/3)`,
`J=−1/R+exp(−2R)(1+1/R)`, `K=−exp(−R)(1+R)`,
`H_AA=−1/2+J`, `H_AB=−S/2+K`.
SciPy solves the symmetric generalized eigenproblem `Hc=ESc` and verifies
S-orthonormality. Total energy adds nuclear repulsion 1/R. The model predicts
R≈2.49283 a₀, E≈−0.56483099 Eₕ; the discrepancy with an accurate H₂⁺ solution
is a limitation of the **fixed-exponent two-function basis**.

The 65³-grid surfaces evaluate the resulting `cA φA+cB φB`, extracting positive
and negative amplitude levels. Atomic A/B views evaluate each original basis
function. The antibonding nodal plane follows antisymmetry; no decorative
molecular geometry is substituted. The bond curve includes both total
energies, electronic and nuclear contributions, minimum and H + proton
asymptote. Surface cache: at most 12 molecular entries; bond curve cached once.

Reference: [MIT 5.61 Fall 2017, problem set 8 solutions](https://ocw.mit.edu/courses/5-61-physical-chemistry-fall-2017/baa9411b4794655a75eb93f81fa26239_MIT5_61F17_pset8_soln.pdf).
MIT includes nuclear repulsion inside its Hamiltonian convention; here it is
separated and added to total energies. The total predictions agree.

## Restricted Hartree–Fock foundation

`quantum_engine/hartree_fock` computes normalized s-Gaussian overlap, kinetic,
nuclear attraction and four-center electron-repulsion integrals analytically
using the Boys F₀ function with a small-argument expansion. Published BSE
STO-3G H/He exponents and contractions are bundled. The expanded option uses
those primitives as independent functions (3 per atom), increasing variational
freedom without claiming a complete-basis result.

SCF uses `P=2 C_occ C_occᵀ`, `F=H+J[P]−K[P]/2`, generalized eigensolves,
20% density damping, ΔE<1e-10 Eₕ and max density change<1e-8, at most 100
iterations. Total energy is `½ Tr[P(H+F)] + E_nuc`. Nonconvergence and failed
invariants raise errors, rather than returning a nominally converged result.
The API returns matrices, ERIs, occupations, iteration history, electron count,
orthonormality and residuals. Total density evaluates `ρ(r)=φᵀPφ`; HOMO/LUMO
surfaces evaluate calculated MO coefficients. The finite-grid density integral
is reported separately from exact basis-space `Tr(PS)=2`.

He/STO-3G gives −2.8077839566 Eₕ; H₂ at 1.4 a₀ gives −1.1167143252 Eₕ.
Uncontracting lowers both energies, to about −2.8162463082 and −1.1200169522 Eₕ.
RHF excludes correlation and fails H₂ dissociation into correlated radicals;
this limitation is displayed alongside the computed energy curve.
