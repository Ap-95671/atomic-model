# Cloudflare Pages browser demo

## Status

**Live website: https://quantum-atom-lab-ap95671.pages.dev/**

Cloudflare Pages project **quantum-atom-lab-ap95671** is deployed from the GitHub
production branch below. The first public deployment used source commit
`f3b86d1207b493580b96d86410608d9ee704ca9e`; `/build-info.json` is the authoritative
current deployment SHA after later commits/redeploys. Actual HTTPS returned 200,
correct CSP/cache headers and matching SHA-256 hashes for all five data assets.
All 12 browser workflows passed against the real HTTPS URL (24.4 s), then 50
full cycles/350 navigation changes passed with zero API/cross-origin requests,
page errors or remaining science workers. The public site runs independently of
the Mac and has no Python backend.

The GitHub app was authorized by the owner for only `Ap-95671/atomic-model`.
No paid resource, card, Worker function, database, R2 bucket or domain purchase
was selected. Automatic builds use only the production branch; unrelated branch
previews are disabled. The Railway Docker option remains separate and undeployed.

Public evidence: `CLOUDFLARE_PUBLIC_HTTP_VERIFICATION.json`,
`CLOUDFLARE_PUBLIC_BROWSER_VERIFICATION.json` and the public desktop/mobile PNGs.
The independent GitHub-runner verification workflow additionally checks the
exact deployed commit and exercises real public HTTPS scientific workflows from
outside the Mac. Its hosted result is reported only once observed.

Branch: `codex/cloudflare-pages-demo`, incorporating all validated navigation
repairs from `eab2212` (PR #9) by an ordinary branch merge. Main and PRs #2–#9
remain unmerged. No Git history was rewritten. Python 3.14.7 and the full local
scientific engines remain intact. Browser availability does not mean every
original 3.0 research feature is complete; existing completion audits still apply.

## Browser execution and model labels

| Feature | Execution | Scope |
| --- | --- | --- |
| s/p/d/f, n=1…8, real/complex phase, clouds, surfaces, nodes, radial/angular plots | Live TypeScript, abortable web worker | Analytic Coulomb functions; reduced mass for one-electron species; illustrative Z_eff otherwise. 41³ marching tetrahedra, ≤8,000 cloud points. Threshold is amplitude, not enclosed probability. |
| Elements, ions, isotope masses and configurations | Browser selection/scaling of bundled curated records | All 118 elements; unverified ions/custom isotopes retain their explicit uncertainty labels. NIST/PubChem source snapshot remains. |
| H₂⁺ bonding/antibonding/atomic views and bond curve | Live analytic Slater integrals + golden-section minimization in worker | One electron, fixed protons, common 1s exponent. Even/odd parity labels remain fixed; poor exponents can reverse the finite-basis energy order. Not exact H₂⁺ or many-electron H₂. |
| H₂, N₂, triplet O₂ and water HF fields | Precomputed Python/PySCF 2.14.0 datasets | HF/STO-3G, fixed reported geometry, preview 41³, threshold .08. Alpha/beta HOMO/LUMO, density/spin density. No browser HF/DFT/geometry run. |
| Ten diatomic MO diagrams | Bundled qualitative reference schemes | Occupancy/bond order/magnetism, ordinal spacing without numerical MO energies. |
| Six molecular structures | Bundled PubChem3D source conformers | Source coordinates/connectivity; not newly optimized experimental structures. |
| Spectroscopy and shell energies | Live energy/scaling/selection calculation with bundled dipole quadrature coefficients | Hydrogenic E1, reduced mass, vacuum wavelengths. No fine/hyperfine/QED or absolute intensity claim. |
| Measurement | Live seeded inverse-CDF Born sampling and quadrature | Accumulation/reset, uncertainties; Mulberry32 differs from NumPy PRNG. No electron paths. |
| Two-state well | Live analytic finite-basis evolution | Exact stationary basis, hard walls; playback is local, no Coulomb/laser solver claim. |
| Ideal circuits | Live worker state-vector math | ≤4 qubits, ≤32 supported gates, ≤5,000 shots; q0 rightmost; no noise/hardware. |
| Chain/square/honeycomb materials | Live analytic tight binding | Illustrative nearest-neighbor parameters and finite-BZ DOS. No fitted real materials or periodic DFT. |

General/3D atomic evolution, tunneling, Lindblad, field experiments, fresh HF/DFT,
geometry/vibrations, correlated/electronic-response jobs and molecular VQE remain
in the full Python environment. Their static tools show explicit unavailability;
no unsupported calculation is fabricated. The visible public guide distinguishes
live calculations, recorded data and advanced local methods. PNG/CSV/JSON exports
retain model/parameter labels; recorded exports include provenance.

## Independent static architecture

- Build only: Node 24.13.0 + existing TypeScript/Vite/Three.js dependencies.
  No new runtime dependency, Pyodide, Python server or macOS environment is needed.
- Scientific work runs in short-lived **browser web workers**, not chargeable
  Cloudflare Workers. Superseded requests terminate their workers; a 15-second
  deadline limits calculations. Preview grids and output budgets are bounded.
- No HTTP `/api/` requests, visitor-localhost requests, external scientific API,
  credentials, telemetry or database. Reference/dataset JSON lives on the same CDN.
- Read-result LRU remains bounded to 16 MiB; two decoded recorded datasets are
  retained. The validated two-context renderer strategy/resource cleanup and
  persistent URL navigation are carried forward from PR #9.
- Hashed JS/CSS/worker/JSON assets are immutable; entry, guide, build-info and
  manifest revalidate. `_headers` supplies CSP/security headers. Real 404.html
  avoids pretending nonexistent server APIs are an HTML SPA response. Actual
  application routes use hash fragments and work on refresh without rewrites.
- No Pages Functions folder, `_worker.js`, storage binding or paid service exists
  in the artifact. Build validation checks the 25-MiB individual-file limit and
  dataset SHA-256 integrity. Artifact currently totals about **3.8 MB raw**;
  datasets and the recorded viewer load only when needed.

## Build and test

```sh
npm --prefix frontend ci
npm --prefix frontend run test:science
npm --prefix frontend run build:pages
npm --prefix frontend run preview:pages
```

In another terminal:

```sh
QAL_STATIC_TEST=1 npm --prefix frontend run test:e2e
node scripts/audit_static_browser.mjs
```

Preview uses 127.0.0.1:8770 and serves the production CSP. Tests block API routes.
`QAL_TEST_URL=https://ACTUAL-DOMAIN` runs those same tests against a deployed site
without starting a local server. The audit supports `QAL_REQUIRE_HTTPS=1`; it
checks source provenance, requests, workers, memory, screenshots and 50 cycles.
An example domain is not a claimed deployment.

Normal `npm --prefix frontend run build` still builds `frontend/dist` for the full
local application; `build:pages` writes a separate `frontend/dist-pages` artifact.
The Railway Dockerfile continues to use the normal build. To use local research,
check out this branch, install the documented core/optional Python requirements,
build normally, then run `QAL_MODE=local .venv/bin/python run.py`.

## Scientific reproducibility

- Regenerate source datasets with `scripts/generate_static_data.py` using Python
  3.14.7 and the documented optional scientific environment. Pages never runs it.
- `scripts/browser_reference_cases.py` generates independent Python expectations;
  `npm run test:science` compares the TypeScript port to those checked-in vectors.
- **5,356 scalar/array checks pass**, covering normalized radial/angular functions,
  nodes, elements/configurations/masses, E1 strengths/wavelengths, generalized H₂⁺
  eigenvalues/matrices, well evolution, circuit amplitudes/reduced states, band
  models, seeded sampling, mesh bounds and four recorded chemistry datasets.
- Radial/harmonic checks use ~2e-12 tolerances; other analytic scalar checks
  typically 1e-10; optimized exponents allow 3e-7 relative/absolute scaling. H₂⁺
  eigenvalue comparisons are unordered when a pathological exponent reverses
  parity energy order. Finite mesh/CDF sampling has separate, reported limits.
- Manifest includes generator, Python/PySCF versions, complete requests, energies,
  filenames and SHA-256 hashes. Public manifest maps each original data file to
  its hashed CDN asset. Source isotope/conformer/configuration provenance remains
  in `quantum_engine/data/SOURCES.md`. Degenerate orbital phases/orientations can
  vary across numerical library environments without changing the physical state.

## Validation record

Twelve static Chromium workflows pass with API routes blocked, including 320 /
768 / 1440 px layouts and accessibility, s/p/d/f and camera interactions, isotope/
ion restoration, H₂⁺ minimization, all recorded molecular fields, spectroscopy
PNG/CSV, measurement accumulation/reset, Bell circuits, well playback, materials,
unavailable solvers, direct links/refresh/history and build provenance.

The local static audit completed 50 full cycles / 350 laboratory changes with zero
API/cross-origin requests, zero page errors and zero live science workers at the
recorded checkpoints. Post-GC parent-page heap remains bounded; this excludes
transient worker, GPU and OS memory. See `CLOUDFLARE_STATIC_LOCAL_VERIFICATION.json`
and local desktop/mobile PNGs. These are local static checks, not public HTTPS
verification. The preserved local application passes 139 Python tests and all 116 browser
workflows. All four initial hosted CI jobs passed at `f3b86d1`: core, chemistry/
browser, Docker/public-container and static Pages.

## Configured Cloudflare Pages Git settings (Free)

- Project: `quantum-atom-lab-ap95671`.
- Repository: `Ap-95671/atomic-model`; authorize **only this repository**.
- Production branch: `codex/cloudflare-pages-demo`; do not merge main to deploy.
- Root directory: **frontend**, so cloud autodetection does not install Python.
- Build command: `npm ci && npm run build:pages`.
- Output: **dist-pages**; Pages config is `frontend/wrangler.toml`.
- Node: **24.13.0**, pinned in frontend/.node-version; set NODE_VERSION if needed.
- No secrets/bindings/functions. Use the free generated pages.dev HTTPS address.
- Disable unrelated preview-branch builds to conserve free build quota.

Cloudflare documents 500 builds/month, 20,000 files/site and 25 MiB/file on Free:
https://developers.cloudflare.com/pages/platform/limits/ . This artifact is well
within those limits. No paid plan/card/custom-domain purchase is authorized or
needed. If Cloudflare requests payment, stop. Do not enable paid Workers, R2 or
other services to work around limits.

Git setup reference: https://developers.cloudflare.com/pages/get-started/git-integration/ .
Once built, verify the actual public HTTPS root, immutable assets, CSP, manifest
hashes and build commit; run the static browser suite and audit externally before
recording success. Updating this production branch triggers a fresh static build;
verify the new SHA and URL after each deployment. Do not publish environment files,
credentials, local test outputs or raw memory snapshots.
