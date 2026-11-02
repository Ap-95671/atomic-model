# Performance measurements — 2 November 2026

macOS arm64, Python 3.14.7, Node 24.13.0, local Chrome. Single-run measurements
are environment/cache dependent; small timing differences are not claimed as
speedups. CPU is process user+system time. Peak RSS is lifetime high-water,
not current allocation or total system memory.

## Original atomic benchmark, before / after

`scripts/benchmark.py`, fresh serial processes, same parameters:

| Case | Before wall / peak RSS | After wall / peak RSS |
| --- | --- | --- |
| Engine import | not timed / 71.4 MiB | not timed / 71.5 MiB |
| Balanced 1s, 18k samples | 0.005 s / 76.4 MiB | 0.005 s / 76.4 MiB |
| High 4f_xyz surface + nodes | 0.290 s / 233.7 MiB | 0.279 s / 233.6 MiB |
| Seven high 4f surfaces, one cache hit | 1.889 s / 268.3 MiB | 1.801 s / 268.3 MiB |

The original geometry algorithm was preserved; these runs indicate no material
memory regression, not an established algorithmic speed improvement.

## New laboratory benchmark

`scripts/benchmark_labs.py`, serial, shared parent process:

| Calculation | Wall | CPU | Parent lifetime peak RSS |
| --- | ---: | ---: | ---: |
| State-resolved dipole | 4.2 ms | 4.2 ms | 72.3 MiB |
| 60,000 2p measurements | 23.5 ms | 23.5 ms | 90.3 MiB |
| Exact well basis/expectation | 0.1 ms | 0.1 ms | 90.3 MiB |
| 1024-cell tunneling, 3000 steps | 46.3 ms | 46.3 ms | 91.4 MiB |
| H₂⁺ antibonding mesh + 121-point curve | 18.2 ms | 18.2 ms | 136.3 MiB |
| H₂ RHF density + 31-point curve | 255.8 ms | 255.3 ms | 140.6 MiB |
| Optional H₂ PBE worker + HOMO mesh | 396.4 ms | 6.0 ms parent | 142.8 MiB |

The last calculation's worker separately recorded 108.9 MiB peak RSS and
334.7 ms CPU. Parent and child high-water marks are not a simultaneous memory
snapshot and should not be added as a precise requirement. Larger molecules,
expanded bases, HTTP serialization, two-job concurrency and browser/GPU memory
are additional. All six conformers and benzene B3LYP/6-31G also converged in the
scientific suite, within the 12-second worker bound.

## Browser and storage

- Baseline 1440×1000 headless Chrome navigation through the loaded 1s cloud:
  798 ms; post-change single run 161 ms. These were not controlled cold-cache
  trials; no 5× speedup claim is made. Baseline median animation-frame interval
  16.7 ms measures scheduling, not GPU execution time.
- Instrumented post-change idle view issued **zero drawArrays calls in 500 ms**.
  Previously the code rendered on every animation frame. Camera/data changes
  still schedule renders; hidden views suspend them. Playback is opt-in and
  capped at ten plot redraws per second.
- Browser regression checks repeated cloud/family/color changes and verified
  GPU buffer counts return within two of initial allocation. Axis textures,
  materials and geometries are explicitly disposed; this is not a proof of
  leak absence across every driver/mode.
- Baseline 320 px document width was 327 px. Tested final atomic width fits
  320/390/768/1024/1440/1920 px; new labs fit their tested 320–1440 px widths.
  Graphs and wide tables scroll locally.
- Final build JS ~629.48 kB / 169.68 kB gzip, CSS ~35.07 kB / 8.88 kB gzip;
  baseline JS 568.37 / 150.39 kB gzip, CSS 26.29 / 6.91 kB gzip. The Vite
  advisory >500 kB chunk warning remains; no threshold suppression is used.
- Installed `.venv` 377 MiB including optional PySCF, `frontend/node_modules`
  113 MiB including browser/a11y test tools. Source/data/screenshots add a few
  MiB. Core runtime does not require the optional 144 MiB environment increase.

No browser GPU-memory, frame-time distribution under every overlay, or total
multi-process memory ceiling was measured. Re-run the scripts on the target
machine rather than treating these numbers as guarantees.
