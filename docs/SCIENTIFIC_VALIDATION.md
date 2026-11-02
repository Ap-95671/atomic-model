# Scientific validation — Quantum Lab 2 milestones

Baseline: 36 tests. Frontend foundation: 12 browser checks. Spectroscopy and
measurement milestone: **46 Python tests, 19 browser tests passed**; production
TypeScript/Vite build passed. Later milestone totals supersede these counts.

New independent checks (`tests/test_experiments.py`):

- Exact infinite-mass `1s–2p` radial integral `256/(81√6)` and z matrix element
  `128√2/243`, matching numerical quadrature to 10 decimal places.
- Summing final 2p magnetic states reproduces nonrelativistic oscillator
  strength 0.41619671798 (test benchmark, not a displayed radiation rate).
- Reverse transition strengths, Z² energy and 1/Z² dipole-strength scaling,
  absorption/emission signs, spin/polarization restrictions and forbidden states.
- Reduced-mass Lyman α agrees within 0.003 nm with NIST vacuum components;
  tolerance includes the excluded relativistic/QED structure. No air/vacuum
  mismatch is hidden by a loose optical-line tolerance.
- Photon E=hf and λf=c, all three monotone series and their limits.
- 60,000 sampled 1s outcomes have mean radius within 0.015 a₀ of 1.5 a₀.
- Fixed-seed 2p_z histogram passes a bin-integrated chi-square check; 2p_z
  analytical ⟨z²⟩=18 a₀² and ground-state σx=1, σp=1/√3 are reproduced.
- Counts plus tail equal batch size; integrated theory plus tail equals one;
  charge scaling preserves dimensionless uncertainty products.
- Invalid states, seeds, counts, multi-electron inputs, polarization and capacity
  limits receive HTTP errors. All original HTTP contracts remain covered.

Browser checks exercise actual WebGL controls, forms, navigation, keyboard tabs,
dialog focus return, errors, loading, cancellation on lab switches, local
save/restore/defaults and successful CSV/PNG downloads. Responsive document
width is measured; plots and wide data tables scroll within their own panels.

These tests establish correctness within the implemented models. They do not
validate missing many-electron, molecular, field or relativistic solvers.
