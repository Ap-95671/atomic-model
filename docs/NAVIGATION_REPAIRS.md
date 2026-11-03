# Navigation, refresh and lifecycle repairs

Validated locally on 2026-11-03, Python **3.14.7**, Node 24, actual Chrome.
This repair branch starts at `516d716` on `codex/railway-deployment`, the latest
validated Quantum Atom Lab 3.0 application including PR #8. Its target is that
branch, not main. Existing scientific engines, features, branches and PRs are
preserved. No Railway/Cloudflare deployment, paid resource or hosting change is
part of this repair. The unfinished static-browser work is preserved separately
on local branch `codex/cloudflare-pages-demo` at `fb72049`.

## Reproduced causes and changes

1. **Refresh had no route state.** Global navigation only toggled DOM visibility;
   every document initialized Atomic Explorer. Internal tools had no URLs.
   Hash routes now identify the laboratory, internal tool, nested circuit/VQE
   tool, session and validated parameter values. Direct links, refresh and
   Back/Forward use one hashchange listener. A deep link mounts the selected tool
   directly rather than briefly starting the default solver first. Invalid
   laboratory/tool/parameter data falls back safely. Parameters are restored
   from the URL, with optional per-tab session storage for revisits. Scientific
   data, credentials and computed wavefunctions are not placed in URLs/storage.

2. **Cancellation could resurrect a job.** JobClient awaited deletion of the
   previous job and only then claimed its revision. Navigation during that
   await could be overwritten by the stale continuation, which submitted a new
   job after its view was disposed. A controlled regression fails on the old
   source (two POSTs instead of one) and passes on the repair. Revision ownership
   is now established before the await. Late POST replies are deleted using
   their own IDs. Polling combines cancellation with a per-request deadline and
   a bounded overall job lifetime; poll failure requests termination of its own
   job. Separate-client jobs remain untouched. Busy/failure messages include
   the existing Calculate retry action.

3. **Revisits caused avoidable work.** Clicking an already active laboratory or
   internal tab remounted it and restarted its default work. Those clicks are
   now no-ops. Successful read-only responses have a 32-entry/16-MiB, five-minute
   LRU; completed job results have a 12-entry/16-MiB, one-minute LRU. Keys include
   every submitted scientific input (canonical sorted request objects for jobs).
   Errors, live jobs, health and capabilities are not cached. Cached JSON is
   reparsed, so an accumulating measurement cannot mutate another cached result.
   Expired calculation IDs clear job-result reuse and produce a recalculate
   message. Requests are not deduplicated through a shared AbortController.

4. **Some display choices repeated SCF.** The legacy HF/DFT adapter previously
   keyed its whole calculation by HOMO/LUMO/density. A private, four-state cache
   now separates the converged electronic state from the selected field, keyed
   by system/method/basis (its fixed geometry, grid and solver settings remain
   unchanged). A new test forbids another SCF kernel during a field change.
   The in-house RHF display adapter similarly reuses its private solved state
   across fields; changing separation/basis/system invalidates that key. The
   existing spin-aware workflow retains its calculation-ID field reuse.

5. **Repeated renderer creation retained detached views.** Heap retainer paths
   led from Three r181's shared DFG lookup DataTexture through per-renderer
   disposal callbacks to old contexts/canvas callbacks and detached lab DOM.
   Disposing geometry and losing the context alone did not release that path.
   OrbitalViewer now reuses at most one idle renderer in addition to Atomic
   Explorer's persistent renderer. It removes owned canvas listeners, controls,
   resize/intersection observers and RAFs, disposes scene geometry/materials/
   maps, clears render lists and returns a clean canvas to that bounded pool.
   Page teardown disposes the pool. Identical nuclei no longer rebuild hundreds
   of marker meshes on every orbital-only change. The scientific lighting and
   material models are preserved.

6. **History changes re-requested the uncached favicon.** Real public-server
   logs showed repeated favicon requests consuming static rate quota during
   normal URL-state updates. The existing SVG icon now goes through Vite's
   source-asset pipeline (a fingerprinted, cacheable SVG), preserving its
   appearance while eliminating those avoidable HTTP requests. Rate limits
   remain unchanged.

7. **Large default display payloads.** Interactive atomic/molecular views now
   start at preview quality. Balanced/high choices remain available. This
   changes display sampling, not Hamiltonians, energies or scientific methods.

## Actual before/after measurements

Measurements are local workflow samples, not universal latency guarantees.
The initial lightweight workflows were already responsive; not every delay was
an expensive solver or a freeze. Heavy chemistry still takes real computation.

| Measurement | Before | Repaired |
| --- | --- | --- |
| Refresh from MO diagrams | Returned to Atomic Explorer | Preserves lab, tool and parameters |
| Replacement POST after navigation during DELETE | 2 POSTs; obsolete job resurrected | 1 POST; stale continuation cancelled |
| Three repeated molecular revisits, science HTTP requests | 3 molecular requests | 0 molecular requests after warmup |
| Same revisit median completion, 3 samples | 52 ms | 36.6 ms (individual 31.8–66.8 ms) |
| Initial atomic display response | 572,710 bytes / balanced 18k points | 167,538 bytes / preview 5k points |
| Initial H₂⁺ display response | 294,672 bytes / 65³ | 165,750 bytes / 41³ |
| Three legacy H₂ HF field selections | 3 SCF solves | 1 solve, two reused-state field evaluations |
| H₂ legacy HOMO / LUMO / density wall time | 0.435 / 0.460 / 0.444 s | 0.343 / 0.333 / 0.328 s |
| 50-cycle JS heap before renderer-reuse repair | 6.4 → 42.7 MiB | Final run 4.8 → 6.3 MiB |
| DOM nodes at cycles 10 / 25 / 50 | 41,151 / 90,111 / 171,711 | Approximately 752 throughout |
| Event listeners at cycles 10 / 25 / 50 | 715 / 1,480 / 2,755 | 98 throughout |
| Final live GL buffers / textures / programs | — | 11 / 13 / 4, stable over 50 cycles |

The memory “before renderer reuse” run is the intermediate repaired router/cache
build immediately before the renderer-pool change, not an invented measurement
of the initial commit. Root analysis required correcting the instrumentation to
account for destroyed contexts and weak context references; retained DOM/heap
still grew, identifying the real shared-texture retention path. Raw heap
snapshots are deliberately not committed (156 MB); small observed records are.

The final profile performs **50 full cycles / 350 navigation changes** through
all seven laboratories. Sample H₂ job: queue ~0.6 ms, solve ~85 ms, display field
~6.2 ms, worker ~95 MiB peak. These timings are exposed separately in the existing
job resources. A follow-up 50-cycle profile recorded zero main-thread tasks ≥50 ms.
CPU-side draw submission is recorded, not claimed as GPU driver
execution time. Post-GC JS heap, DOM counts and live GL object counts do not
represent total browser/OS/GPU memory. Browser/version/device differences matter.

Raw records: `NAVIGATION_BEFORE.json`, `NAVIGATION_AFTER.json`,
`NAVIGATION_MEMORY_BEFORE_RENDERER_REUSE.json`, `NAVIGATION_OPTIONAL_SCF.json`.
Reproduce with `node scripts/profile_navigation.mjs` against the local server
(default 8771), or set `QAL_TEST_URL` explicitly.

## Regression coverage and validation

- **139 Python tests pass**, including unchanged science/API/SDK checks and new
  display-state reuse checks. The optional field test mocks the SCF kernel to
  fail if it is called again, while preserving energy/electron counts. A larger water/6-31G state also
  round-trips through the bounded 2-MB worker protocol.
- **116 full-local Chromium workflows pass**, including the automated
  **50-cycle regression**.
- **31 navigation regressions pass**: all 23 direct-link/tool/refresh routes,
  Back/Forward, parameter restoration, invalid routes, same-document fragment
  edits, rapid option changes, atomic and computed O₂ orbital restoration,
  no-op navigation, keyboard skip-link focus without route/history changes,
  identical-result reuse, cancellation during an actual
  expensive calculation and independence of another active job, and 50 cycles.
- **Eight public-mode Chromium workflows pass** on a local public ASGI server;
  this does not claim a deployed website.
- **Four shared lifecycle/cache scenarios pass** in
  `node scripts/test_frontend_lifecycle.mjs`: replacement cancellation race,
  late POST ownership, hung polling deadline/owned stop, bounded LRU/full keys.
  The helper is included in GitHub CI after frontend dependency installation.
- TypeScript/production build passes. The existing >500-kB Vite bundle advisory
  remains; splitting the whole application is outside this focused repair.
- Desktop/mobile, WebGL, s/p/d/f, elements/ions, methods, plots, numerical errors,
  unavailable features and CSV/JSON/PNG exports are covered by the preserved
  browser workflows. No scientific feature or dependency was removed.

Hosted CI status is reported only after it is observed. No PR is merged here.

## Files changed

- `frontend/src/app/navigation.ts`, new `app/route.ts`: route and mount lifetimes.
- `frontend/src/labs/{molecular,dynamics,experiments,computation,quantum-computing}.ts`:
  mount only the selected tool; no-op re-selection.
- `frontend/src/labs/{session,computed-molecules}.ts`: lifecycle/status/parameter
  restoration, dynamic orbital restoration and existing SCF field reuse.
- `frontend/src/main.ts`: atomic URL state, cancellation and preview defaults.
- `frontend/index.html`, `frontend/src/favicon.svg`: same icon through Vite asset
  processing; no repeated uncached icon fetches on history changes.
- `frontend/src/services/{api,jobs}.ts`, new `services/result-cache.ts`: bounded
  reuse, ownership and deadlines.
- `frontend/src/visualization/viewer.ts`: renderer reuse and owned-resource cleanup.
- `backend/{optional_computation,molecular_geometry}.py`: display/SCF separation.
- `backend/jobs/{manager,worker}.py`: queue/solve/field timing diagnostics.
- `frontend/tests/{navigation,atomic,advanced,labs}.spec.ts`: actual regressions;
  older overload tests use new input keys so they still reach the backend.
- `tests/test_navigation_performance.py`, `scripts/test_frontend_lifecycle.mjs`,
  `scripts/profile_navigation.mjs`, `.github/workflows/validation.yml`: checks.
- This report and four JSON measurement records.

## Limits

Long legitimate HF/DFT/correlation/geometry jobs still take time. The legacy
read-only optional-computation HTTP path has a 12-second worker limit; aborting
its HTTP response prevents stale UI updates but does not provide job-ID process
cancellation. The advanced job API does support true process cancellation and
is tested here. Cached results have strict bounds and may be evicted; source
calculation-ID eviction produces an explicit recalculate error. No universal
memory/performance claim is made for untested drivers, arbitrary heavy models,
or exhaustive user workflows. Full camera serialization and a general offline
workspace format remain outside this repair.
