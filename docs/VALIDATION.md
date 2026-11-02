# Validation record

Validated locally on **2 November 2026**, macOS arm64, Python **3.14.7**,
Node **24.13.0**, npm **11.6.2**.

## Automated checks

- `.venv/bin/python -m unittest discover -s tests -v`: **36 tests passed**.
- `cd frontend && npm run build`: TypeScript checking and Vite production build passed.
- `.venv/bin/python -m pip check`: no broken requirements.
- `git diff --check`: passed.
- All 118 element records have consistent neutral electron counts, valid periods,
  and unique display cells. All 354 isotope records in this snapshot come from
  the NIST table. The rebuild script also supports explicitly labeled fallbacks.
- Original Pygame startup and graceful exit passed under SDL dummy video/audio;
  no original Python module was changed.

The science tests use independent analytic identities and orthonormality
quadrature, not screenshots as physics evidence. They include Monte Carlo
moment checks and evaluate extracted mesh vertices against the wavefunction.
See the test modules for tolerances and coverage.

## Browser checks

The locally served compiled app was exercised in the in-app WebGL browser:

- Hydrogen 1s probability cloud and individual proton picking.
- 2s radial node count and radial probability graph.
- 2p signed lobes and numerical nodal plane.
- Distinct 3d_z² lobes/torus and a computed 4f state.
- Complex m=2 state selection and cyclic phase legend.
- Phase/density switching; orbit rotation, scroll zoom, and camera reset.
- Five-orbital 3d overlay with a shared scale and individual layer visibility.
- Search for iron, select Fe, enter charge +2: 24 electrons, [Ar]3d6, no 4s occupancy.
- Select helium-3 with charge +1: 2 protons, 1 neutron, 1 electron.
- Hydrogenic energy panels for H and He⁺. Typing n=4 → n=2 for H updates the
  wavelength to about 486.27 nm; He-3⁺ n=3 → n=2 gives about 164.06 nm.
- Desktop/sidebar and narrow responsive layouts were inspected.

Screenshots: `quantum-lab-4f.png`, `quantum-lab-3d.png`. These are actual UI
captures, not generated mockups. The 3d screenshot is scrolled to include the
radial graph.

## Performance and known diagnostics

`scripts/benchmark.py` reported approximately 77 MiB peak Python RSS for a
balanced 1s cloud, 234 MiB for one high-detail 4f_xyz surface with nodes,
and 268 MiB after caching seven high-detail 4f geometries. Backend imports
accounted for roughly 72 MiB. Browser/GPU allocation, response serialization,
and concurrent requests are additional. Figures are environment-dependent
process high-water marks, not guaranteed operating-system memory limits.

Vite warns that the Three.js-containing JS bundle exceeds its advisory 500 kB
chunk threshold (~568 kB uncompressed, ~150 kB gzip). This is a local offline
application and the production build succeeds. scikit-image 0.26 emits internal
NumPy 2.5 array-shape deprecation warnings during marching cubes; the validated
calculations and tests succeed. These diagnostics are retained rather than
silenced globally.

Scientific limits (many-electron approximation, reference-ion coverage,
high-Z corrections, isotope stability and finite meshes) are documented in
`README.md` and the in-app scientific guide.
