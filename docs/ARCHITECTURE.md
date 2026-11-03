# Architecture · 3.0 alpha

The original Pygame modules and launch remain intact. `run.py` serves the
loopback-only standard-library HTTP API and compiled TypeScript/Three.js app.

| Layer | Ownership |
| --- | --- |
| `quantum_engine` | Mathematical models, pure numerical solvers, scientific geometry and bundled data; no HTTP/DOM/Three.js |
| `quantum_atom_lab` | Versioned experimental public SDK; lazy optional calculations, direct synchronous API |
| `research_engine` | Evidence-limited baseline selection and packaged generated benchmark artifact |
| `backend/api` | Strict finite query/JSON-to-model adapters; original routes preserved |
| `backend/jobs` | Bounded subprocess orchestration, JSON-line progress, cancellation, timeout, scratch/result lifetimes |
| `backend/geometry.py` | Compatibility exports of reusable `quantum_engine.geometry` |
| `frontend/src/services` | Typed fetch/job polling, stale-response revisions, exports and catalog caching |
| `frontend/src/labs` | One mounted scientific workflow and contextual controls per controller |
| `components` | Escaped HTML/dialog helpers, SVG charts and bounded opt-in playback |
| `visualization/viewer.ts` | Three.js only; fixed-frame structure motion, weighted clouds/Bloch vectors, mesh/buffer disposal |
| `app/navigation` | One active lab lifetime; disposes previous work before mounting next |

Original GET contracts remain. New core `/api/physics` accepts allowlisted
operations with finite JSON parameters ≤8192 characters. Core calculations are
short and bounded; they use the same two-slot semaphore as legacy calculations
and chemistry jobs. Input errors: 400; missing/expired job: 404; expired
calculated state for field reuse: 410; capacity/dependency: 503.

New chemistry protocol: POST `/api/jobs` (JSON ≤32768 bytes), GET
`/api/jobs/<id>`, DELETE to cancel. Operations are SCF/field, optimization,
vibrations, correlation, electronic response, bounded H2 scan and H2 VQE.
`ChemistryRequest` and operation-specific options validate types/ranges/catalogs;
no arbitrary code, file paths or shell text is accepted. Fixed module workers
use JSON lines for progress/results. Real cancellation kills/reaps the worker;
a 90-second timer does the same on timeout. Terminal status is published only
after slot release/process cleanup. Native-thread environment is bounded.

Limits: 16 HTTP handlers, two shared compute slots, 16 job records, four stored
calculated solutions. Field jobs reuse orbitals/density matrices and immutable
calculation geometry/method; only view/spin-orbital/threshold/quality changes are
allowed. Optimized fields use the final nuclei, never the starting conformer.
Scientific/basis/CI/time bounds constrain requests. PySCF workspace memory is a
hint rather than a hard OS cap; public deployment requires stronger isolation.
The preserved legacy HF/DFT GET path retains its separate 12-second worker/cache.

Core imports never load PySCF/QuTiP. Optional availability is checked before
starting jobs, and failure does not disable original atomic/physics tools.
Direct SDK calls execute in the caller process and do not inherit job timeouts.
Canonical source-provenance data remain under `data/`; synchronized copies under
`quantum_engine/data` travel in wheels and are byte-checked in tests.

`LabSession` owns request revisions, input invalidation, real job cancellation,
loading/errors and local presets. `JobClient` handles late POST responses so a
cancelled client still cancels a newly assigned server ID. Atomic failed states
explicitly mark retained geometry; stale exports remain disabled. No obsolete
result silently updates changed controls.

The viewer renders on demand, pauses hidden views, reuses position/color/weight
buffers during atomic playback, and updates existing atom/bond transforms during
normal modes. Camera controls have one lifetime; disposal releases geometries,
materials, textures and the WebGL context. Data playback is opt-in and ≤10 Hz;
camera rendering remains browser-frame-driven as needed. Scientific coordinates
and schematic particle radii are labeled separately.

The sizable original atomic controller/styles are preserved with incremental
extraction. No replacement framework, Kubernetes, remote account or paid API is
required. Public-demo architecture is documented separately; local safeguards
are not presented as multi-tenant production readiness.


## Railway public-mode adapter

`run.py` defaults to full local mode. `QAL_MODE=public` selects the new Uvicorn
ASGI gateway (`backend/production.py`) with policy normalization, bounded request
rates/response cache and one isolated core-science worker. It does not expose
the development `http.server`. Runtime capabilities configure public preview
controls and advanced-local availability messages. Catalog/element metadata do
not compete with science, and busy/rate responses have bounded cancellable
backoff. Docker copies built assets and core dependencies; PySCF is omitted.
Every original local API remains implemented. See `RAILWAY_DEPLOYMENT.md` for
exact resource limits and the cloud billing blocker; source readiness is not a
claim of public deployment.
