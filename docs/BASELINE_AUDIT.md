# Baseline audit — 2 November 2026

Starting commit: `ff99a54` on `main`, fetched from origin and verified identical.
Working tree was clean. Development branch: `feature/quantum-lab-2`.
Environment: macOS arm64, Python 3.14.7, Node 24.13.0. Existing virtual
environment and original seven Pygame modules are preserved.

## Reproduced checks

- 36 unittest tests pass in 0.929 s, including seven HTTP contract tests.
  The restricted execution sandbox cannot bind sockets; full HTTP tests were
  rerun with local-process permission. This is an environment restriction.
- TypeScript check and Vite build pass: JS 568.37 kB / 150.39 kB gzip;
  CSS 26.29 kB / 6.91 kB gzip. Vite reports its advisory large-chunk warning.
- Chrome headless, 1440 × 1000: initial navigation through the loaded 18,000
  point hydrogen 1s cloud took 798 ms. Median of 120 animation-frame intervals
  was 16.7 ms. This measures browser scheduling, not GPU execution time.
- Widths 320, 390, 768, 1024, 1440 px were measured at height 900 px.
  Document widths: 327, 390, 768, 1024, 1440 px respectively. **7 px overflow
  reproduced at 320 px**. Tablet and small laptop use a long stacked layout.
- Actual UI captures: [desktop](baseline-desktop.png),
  [320 px mobile](baseline-mobile.png).
- API health, all 118 elements, isotope/ion composition, 2p cloud and nodes,
  H/He+ transitions, invalid inputs and traversal rejection pass existing tests.

## Backend benchmark

`python scripts/benchmark.py`, serial fresh process; lifetime peak RSS, not
current allocations; browser/GPU and HTTP serialization excluded:

| Case | Wall time | Peak RSS |
| --- | ---: | ---: |
| Imported engine | not measured | 71.4 MiB |
| Balanced 1s cloud | 0.005 s | 76.4 MiB |
| High 4f_xyz surface + nodes | 0.290 s | 233.7 MiB |
| Seven high 4f surfaces, one cached | 1.889 s | 268.3 MiB |

CPU utilization and GPU memory were not measured. No baseline speedup claim
should be inferred from these single-run measurements.

## Substantiated implementation issues

- `main.ts` (883 lines) combines HTML, async requests, modal management,
  graph generation and atomic state. `styles.css` is 1965 lines; viewer 406.
- Transition success has a request guard, but its failure path does not check
  species or request identity. An obsolete failure can overwrite newer output.
- Repeated energy-panel renders share species identity but no panel revision;
  overlapping renders can replace controls after input. No fetch timeout exists.
- Viewer schedules and renders every frame even while idle or hidden.
- `dispose()` omits axes; axis sprites own CanvasTextures, which material
  disposal alone does not free. Recoloring allocates replacement GPU buffers.
- CSS shrinks several mobile labels to 7–9 px, including slider controls.
- Analysis tabs declare tab roles but lack arrow-key navigation and associations.
- WebGL initialization failure returns before loading textual species data.
- Calculations are bounded to two concurrent geometry jobs; HTTP request-handler
  threads themselves are not bounded. Client abort does not stop a running
  NumPy job. Neither is presented as a public deployment architecture.

## Scientific scope at baseline

Analytic, reduced-mass hydrogenic s/p/d/f states; real/complex harmonics;
clouds, isosurfaces and nodes; reference configurations, ions/isotopes;
n-only Coulomb transition differences; schematic nuclei; unchanged legacy
Bohr comparison. No molecular SCF, dynamics, tunneling, field or DFT engine.
Finite grids, illustrative many-electron Z_eff and incomplete ion references
are already disclosed. scikit-image emits upstream NumPy deprecation warnings.
