# Railway public-demo deployment

## Actual status — 2026-11-03

**Not deployed. There is no public HTTPS URL, cloud service or deployed commit.**
The Railway account is authenticated and its workspace has zero projects.
Its dashboard explicitly reports:

> Trials are temporarily paused for new accounts. Upgrade to a paid plan to start deploying.

The owner authorized **free/trial credits only, no paid charges**. No upgrade,
card entry, paid resource, project, deployment or domain has been created.
Railway must enable a free/trial-capable workspace before activation can continue
within this budget. Signing in/connecting the plugin is complete; billing access
is the current blocker. This is not a Docker/build failure.

The deployable branch is `codex/railway-deployment`, based on the validated 3.0
alpha head `d6c0d05`, not outdated main. Existing PRs #2–#7 remain unmerged.
Render, AbhiAI and Custerra are not used or modified. No tunnel/localhost sharing
is provided. Local container verification below is **not** a public deployment.

## Architecture and modes

A multi-stage Dockerfile builds Vite/Three.js using pinned Node 24.13.0, then
copies compiled assets and Python source into an independent Python 3.14.7 Linux
runtime. Base-image digests and production dependency constraints are pinned.
No macOS virtualenv or node_modules is copied. Runtime UID/GID are 10001;
PySCF/Pygame are absent in the public image. Three.js's existing MIT notice is
served at `/third-party-notices.txt`; no project-wide license has been chosen.

The original advanced local server/science remain available through
`QAL_MODE=local python run.py`, defaulting to 127.0.0.1:8765. It preserves all
scientific APIs and optional native methods. The public entry point uses Uvicorn
and a fixed-protocol ASGI gateway, **not** `http.server` exposed to the Internet.
Python explicitly cautions that its standard-library HTTP server is unsuitable
for production: https://docs.python.org/3/library/http.server.html .

Public frontend/assets/APIs share one origin and all scientific fetches use
relative URLs. Vite's localhost proxy is development-only. Railway terminates
HTTPS; the app listens on 0.0.0.0 at Railway's injected `PORT`. No visitor's
localhost is queried. Asset fingerprints receive immutable caching; index and
API responses do not use stale browser caching. CSP permits the application's
SVG/blob image exports while excluding arbitrary external scripts/connections.

## Public scientific scope

| Available in bounded public mode | Restriction |
| --- | --- |
| Atomic s/p/d/f, clouds/surfaces/nodes, all elements/isotopes/ions, camera and explanations | Preview 49³, 1,000–8,000 cloud points; original hydrogenic assumptions unchanged |
| H2+ LCAO/basis optimization and bond curves | Preview 41³; full PySCF molecule jobs remain local |
| MO reference diagrams / source molecular structures | Explicit reference/PubChem conformer labels retained |
| Spectroscopy, measurement and well dynamics | Measurement batch ≤10,000; spectral finite-basis limits unchanged |
| Tunneling / weak fields | Tunneling 1024 cells / ≤3000 steps |
| Atomic superpositions / Lindblad | ≤6000 display points; bounded existing core models |
| Ideal circuits / tight-binding models | ≤4 qubits / 5000 shots; BZ grid ≤81² |
| Adaptive evidence lookup | Offline measured lookup with abstention, no new chemistry computation |

PySCF/DFT, geometry/vibrations, correlation, electronic response, molecular VQE,
and in-house HF grids/curves return explicit advanced-local-mode availability
messages. Their source implementations remain intact. No unsupported result is
fabricated. Computational Chemistry defaults to the supported evidence lookup;
advanced tabs retain explanations/parameters without running jobs.

## Workload and request controls

- One scientific subprocess at a time, no unbounded compute queue. Metadata is
  served without competing with an orbital calculation.
- Default 8-second wall deadline, CPU limit 8 seconds (9-second hard ceiling),
  Linux worker-RSS watchdog 192 MiB checked every 50 ms; exceeded workers are
  killed/reaped. The watchdog is not a hard kernel memory cap; the container's
  RAM limit is the final protection. Timeouts never return scientific success.
- Query/body protocol is fixed JSON with allowlisted operations and bounded
  values. No arbitrary code, paths, shell commands or backend library names.
  Worker stdout ≤4 MiB; child scratch/pipe/process lifetimes are cleaned up.
- Result cache: ≤32 responses / 16 MiB, 300-second TTL. Versioned metadata is
  warmed once per process. Successful results only; cache sizes cannot grow
  with unlimited parameter combinations.
- API token buckets: 60/minute per remote address (burst 40), 120/minute global
  (burst 60). Static responses: 120/minute per address (burst 40), 240/minute
  global (burst 60). Tables have ≤2048 keys. Health/capabilities stay available.
  Arbitrary forwarded IP headers are not trusted; a shared proxy can make the
  per-address limit aggregate multiple visitors. This is conservative for cost.
- Uvicorn: 32 connection/task limit, 32 backlog, 16 KiB incomplete HTTP event
  limit, five-second keepalive. Only public GET/HEAD; mutation jobs unavailable.
- API returns bounded 400/404/405/429/503 errors, retry guidance and sanitized
  failures. Client busy/rate retries are limited to three attempts and respect
  cancellation and the existing 30-second request deadline. No infinite retry.

These safeguards reduce low-cost-demo risks; they are not a claim of a formal
security audit, universal DDoS protection or guaranteed unlimited free hosting.

## Build and verify independently of the Mac environment

```sh
docker build --platform linux/amd64 -t quantum-atom-lab:railway .
docker run --rm --name qal-public \
  --memory=512m --cpus=1 --pids-limit=64 --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  -p 127.0.0.1:8767:8080 -e PORT=8080 quantum-atom-lab:railway
```

In another terminal:

```sh
python3 scripts/wait_public.py http://127.0.0.1:8767/api/health
python3 scripts/public_smoke.py http://127.0.0.1:8767
QAL_PUBLIC_TEST=1 QAL_TEST_URL=http://127.0.0.1:8767 npm --prefix frontend run test:e2e
```

No server running on the host's .venv is used by these requests. The extra
read-only/tmpfs/pid settings above were tested locally; Railway's actual host
resource/security controls must be configured/verified when a service exists.
The separate 85-test full-local suite runs without `QAL_PUBLIC_TEST=1`.

## Environment variables

| Name | Public container value / behavior |
| --- | --- |
| `QAL_MODE` | `public` in image; ordinary checkout defaults to `local` |
| `QAL_HOST` | `0.0.0.0` in image; local server defaults to `127.0.0.1` |
| `PORT` | Injected by Railway; 8765 fallback, tested with 8080 |
| `QAL_COMPUTE_TIMEOUT` | 8 seconds, accepted range 1–15 |
| `QAL_WORKER_MEMORY_MIB` | 192, accepted range 96–256; Linux RSS watchdog |
| `OMP_NUM_THREADS`, `OPENBLAS_NUM_THREADS`, `MKL_NUM_THREADS`, `VECLIB_MAXIMUM_THREADS` | All 1 |
| `RAILWAY_GIT_COMMIT_SHA` | Railway-provided provenance exposed in health output |

No database, persistent volume, cloud API key, GPU or paid quantum service is
needed. `.env.example` documents local settings; no secret is stored in Git.

## Resource and cost evidence

Local Linux/amd64 Docker tests used a **hard 512 MiB limit, one CPU**, non-root
identity, read-only image and 32 MiB /tmp. The runtime image is about **140 MB
uncompressed (134 MiB)**. Observed public peaks were approximately 129–151 MiB
across HTTP/browser workloads; idle working-set memory was roughly 35–45 MiB.
The container remained healthy and had one process after worker cleanup. These
are representative measurements, not a worst-case proof. Core/source-array,
response/cache/concurrency limits plus the 512 MiB cgroup provide headroom.

Do not host the full advanced two-job PySCF application in that small instance.
Some advanced local workloads approach hundreds of MiB per process; this image
omits that backend. A larger instance would require separate measurements and
explicit paid-budget approval, which has **not** been given.

Railway's published Free limits currently include 0.5 GB RAM / 1 vCPU and $1
monthly credits; Trial availability and eligibility are account dependent. Their
pricing documentation lists RAM $10/GB-month, CPU $20/vCPU-month and egress
$0.05/GB. At 35–45 MiB continuously resident, RAM alone is roughly $0.35–$0.45
per month; CPU, active-worker memory, page-cache metering, traffic and egress add
usage. This is an estimate, not a guarantee that an active site fits $1/month.
An exhausted free allowance can suspend the site. No always-on SLA is promised.

Current sources: https://docs.railway.com/pricing/plans and
https://docs.railway.com/pricing/cost-control . The live account's paused-trial
message takes precedence over generic marketing availability. No Hobby/Pro plan,
paid charge or higher budget was selected; current cloud usage for this task is
zero because nothing was deployed.

## Activation after free/trial deployment becomes available

Only after the account permits deployment within the approved zero-paid budget:

1. Create **Quantum Atom Lab** in the eligible Railway workspace.
2. Connect only `Ap-95671/atomic-model`, branch `codex/railway-deployment` (or
   its exact reviewed successor). Do not merge PRs simply to deploy.
3. Use root Dockerfile and committed `railway.toml`; one replica, no database/
   volume or preview replicas. Set/verify ≤0.5 GB RAM / 1 CPU service limits.
4. Keep `QAL_MODE=public`, let Railway supply `PORT`, and use `/api/health`
   with a 90-second healthcheck timeout. Restart attempts are limited to two.
5. Confirm the plan/credits cannot incur paid overages; do not change unrelated
   workspace projects or billing policies. If not possible, stop rather than
   silently upgrade.
6. Deploy and inspect build/runtime logs. Only then generate a Railway HTTPS
   domain and verify it externally. Record actual project/service/domain IDs,
   commit SHA and resource configuration; none exists yet in this report.
7. Run `python scripts/public_smoke.py https://ACTUAL-DOMAIN --require-https`
   and `QAL_PUBLIC_TEST=1 QAL_TEST_URL=https://ACTUAL-DOMAIN npm --prefix frontend
   run test:e2e`, then inspect logs/metrics under real requests.

Those uppercase domains are command examples, **not** a deployed address.
Only a healthy, publicly reachable HTTPS service with actual science/browser
checks satisfies deployment completion.

## Troubleshooting and redeployment

- Startup/health failure: inspect logs, `PORT`, 0.0.0.0 binding and frontend files.
  A missing built index correctly makes health 503; Docker never uses .venv.
- 400 means invalid/public-limit input; 429 is bounded rate limiting; 503 is
  busy/resource/unavailable advanced mode. Retry after guidance or use local mode.
- WebGL unavailable: numerical results/explanations remain; enable browser
  hardware acceleration. Same-origin API paths avoid production CORS issues.
- New bundle not loading: index is no-cache; fingerprinted assets are immutable.
  Confirm the deployment SHA and rebuild, rather than hardcoding localhost URLs.
- Do not bypass the trial/billing blocker, add a card or select a paid plan without
  new explicit owner approval. Contact Railway for free/trial eligibility or use
  an existing eligible workspace if the owner supplies one.
- Redeploy by pushing the reviewed source branch after tests; Railway rebuilds
  the container. Inspect the new SHA/health/domain again. Keep prior known-good
  deployment available for rollback when the platform supports it.

## Validation record

At the local checkpoint: 136 Python tests, preserved 85 full-local Chromium
workflows and eight dedicated public-container browser workflows pass. Production
build, 24 real scientific HTTP checks, image/non-default PORT health and resource
limits were exercised. New CI defines an independent Linux Docker/public-browser
job alongside core and optional-local jobs; hosted CI results are reported only
when observed. See `RAILWAY_CONTAINER_VERIFICATION.json` for the actual localhost
HTTP run. It explicitly records `https_verified: false`.
