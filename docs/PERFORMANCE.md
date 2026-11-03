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

## 3.0 alpha measurements (new checkpoint)

Reproduce `scripts/benchmark3.py`; raw environment/records: `benchmark3.json`.
Python 3.14.7, NumPy 2.5.4, SciPy 1.18.1, PySCF 2.14.0, macOS arm64. One cold
isolated process per case; native libraries restricted to one thread.

| Workload | Solver/field wall | CPU | Cold process wall | Process peak RSS |
| --- | ---: | ---: | ---: | ---: |
| O2 UHF / balanced field | .157 s | .113 s | .402 s | 107.7 MiB |
| Water optimize + harmonic modes / preview | .270 s | .225 s | .608 s | 110.6 MiB |
| Water CCSD / preview reference field | .147 s | .143 s | .414 s | 99.7 MiB |
| Water 3 singlet TDHF states / preview field | .236 s | .220 s | .501 s | 112.3 MiB |
| H2 ideal JW VQE / preview reference field | .109 s | .106 s | .368 s | 97.0 MiB |
| General 4-state well | .31 ms | .31 ms | .235 s | 72.2 MiB |
| 3D atomic spectral evolution / 6000 points | 7.10 ms | 7.10 ms | .254 s | 75.3 MiB |
| Qubit Lindblad / 201 frames | 3.23 ms | 3.23 ms | .277 s | 72.1 MiB |
| Bell circuit / 2000 shots | .17 ms | .18 ms | .244 s | 71.9 MiB |
| Honeycomb 81×81 BZ/DOS | .84 ms | .84 ms | .238 s | 72.4 MiB |

Core model timings exclude their module imports; cold-process timings include
imports/startup. Worker solver/field resources are measured through computation,
before final JSON serialization; the cold latency includes serialization. These
are default small cases, not worst-case/high-basis/all-concurrent limits. PySCF
workspace memory is a hint. No hard total-process or GPU memory ceiling is claimed.

Original `scripts/benchmark.py` rerun unchanged after extraction into the SDK:
balanced 1s .005 s / 76.7 MiB, high 4f_xyz .282 s / 235.2 MiB, seven high 4f
surfaces 1.836 s / 269.8 MiB. Compare the historical .279 s / 233.6 MiB and
1.801 s / 268.3 MiB above: similar behavior, no demonstrated speedup. The
scientific geometry algorithm is unchanged; differences are uncontrolled runs.

Actual Chrome audit: `scripts/browser_audit3.mjs`, `browser-audit3.json`.
1440×1000 atomic-ready latency 166.2 ms (single warm/local run); 1.5 seconds
of atomic weighted-cloud playback produced 120 draw calls and **zero buffer
creation/deletion**; 400 ms paused/idle produced **zero draw calls**. Median
animation-frame scheduling interval 16.7 ms is not measured GPU execution time
or an application FPS guarantee. Data updates intentionally cap at 10 Hz.
Console errors: zero. Captured mobile document width equals the 390 px viewport.

Final alpha bundle JS 694.57 kB / 186.37 kB gzip, CSS 35.53 / 9.01 kB gzip,
versus 2.0 JS 629.48 / 169.68 gzip. More working labs add bundle weight;
code splitting remains a useful follow-up. The >500 kB Vite advisory remains
visible, with no warning-threshold suppression. No all-overlay GPU-memory,
frame-time distribution or adversarial concurrent load claim is made.

## Railway public-container checkpoint

Independent Linux/amd64 runtime on Docker Desktop (macOS/arm64 emulation), Python
3.14.7, one CPU and hard 512 MiB memory. Image size **140,406,699 bytes** (~140 MB,
134 MiB), runtime UID/GID 10001, read-only filesystem and 32 MiB tmpfs in tests.
Observed working set after requests: ~35–45 MiB; representative cgroup peaks
~129–151 MiB. One process remains after scientific workers exit. These limits
are appropriate evidence for the bounded public preview, not the full local
PySCF app or all traffic/worst cases. Emulated timings are not native Railway
benchmarks. See `RAILWAY_CONTAINER_RESOURCES.json` for exact settings/measurements.

24 actual HTTP/science checks pass; eight dedicated public Chromium workflows
pass (26.6 s), including f surfaces, rotation/zoom, element selection, PNG exports
under CSP, spectroscopy/measurement/dynamics and mobile layouts. All 85 full
local browser regressions also pass (~1.2 min); 136 Python tests pass (17.607 s).
Metadata no longer competes for the single scientific worker; bounded backoff
handles transient public busy/rate responses without unbounded server queues.

No Railway service is running: the authenticated account requires paid upgrade
while the allowed budget is free/trial only. Container measurements and localhost
success do not demonstrate public HTTPS reachability or deployment completion.
