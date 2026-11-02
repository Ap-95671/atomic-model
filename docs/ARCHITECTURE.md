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
server is a local instrument; handler-thread scheduling and hostile remote
multi-user operation are outside the current deployment model.
