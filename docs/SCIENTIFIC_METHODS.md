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
