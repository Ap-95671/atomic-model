# Architecture

The seven original Pygame modules remain intact. `run.py` still launches the
loopback-only standard-library HTTP server and offline compiled frontend.

- `quantum_engine`: original atomic code plus independent spectroscopy,
  measurement and dynamics modules. No HTTP, DOM or Three.js dependencies.
- `backend/api/experiments.py`: query adapters, validation and model dispatch.
  Original API paths are unchanged. Scientific requests share the two-job
  semaphore and reject overload with 503. Each new engine bounds its states,
  samples, grid and/or propagation steps. Serialization rejects nonfinite JSON.
- `frontend/src/services`: timeout/cancellation-aware typed fetches, CSV/PNG
  export with model/parameter/unit information.
- `components`: escaped HTML helpers, native dialog lifecycle, SVG plots and
  a playback controller that owns and cancels its animation-frame loop.
- `app/navigation`: one mounted lab lifetime; switches call cleanup first.
- `labs`: separate spectroscopy, Born-rule measurement, exact well dynamics
  and numerical tunneling controllers. `LabSession` owns request revisions,
  aborts, status/error messages, validation and versioned local presets.
- `main.ts`: existing atomic controller, with shared responsibilities extracted.
  Further atomic state/template separation remains possible; no UI framework
  was introduced.
- `visualization/viewer.ts`: Three.js rendering only. On-demand frames,
  visibility suspension, buffer reuse and explicit GPU resource disposal.

New GET APIs: `/api/spectroscopy`, `/api/spectroscopy/transition`,
`/api/spectroscopy/series`, `/api/measurement`,
`/api/dynamics/superposition`, `/api/tunneling`. New APIs return model/units
alongside scientific results. Input/model errors return 400, unknown routes
404, capacity exhaustion 503, unexpected errors 500. No endpoint writes files,
launches processes or executes supplied code.

Client abort cancels obsolete display work; it does not interrupt an active
NumPy calculation. Bounded engine workloads terminate independently. This
server is a local instrument; hostile remote multi-user operation is outside the current deployment model.
Handler concurrency was subsequently bounded as described below.

## Integrated advanced methods

`molecular` now includes analytic H₂⁺ LCAO, source-backed structures and
qualitative occupation schemes. `hartree_fock` is the independent He/H₂
Gaussian-integral/SCF foundation. `fields` owns n=2 hydrogen angular momentum,
Stark/Zeeman and Dirac calculations. Geometry adapters compute surfaces from
wavefunction/density fields; source structure sticks are labeled schematic.

Optional PySCF stays in `backend/optional_computation.py`: fixed whitelisted
system/method/basis inputs, an internal Python module worker, no shell,
12-second process timeout, bounded cache and batch AO evaluation. The core
server does not import PySCF. The runtime checks installed availability and
reports failures explicitly. Same-geometry HF comparisons run in the same
compute slot, sequentially, with a cache of at most four results.

The application server now bounds live HTTP handlers to 16 and sets a
30-second socket timeout. Overload receives JSON 503; scientific jobs remain
limited to two. Cache limits: original atomic geometries 16; molecular LCAO 12;
RHF field payloads 8; optional native results 4. NumPy work is not forcibly
interrupted by a browser abort; native workers are killed at timeout.

Additional APIs: `/api/molecular`, `/api/molecular/diagram`,
`/api/molecular/structure`, `/api/computation/hartree-fock`,
`/api/computation/pyscf`, `/api/fields`. No prior API contract was removed.

The existing atomic controller/template remains sizable; shared components,
services and every new lab live outside it. Its further decomposition can be
incremental. No large frontend framework or runtime chart dependency was added.
