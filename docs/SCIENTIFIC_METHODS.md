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
