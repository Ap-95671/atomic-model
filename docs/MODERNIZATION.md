# Atomic Model frontend modernization

3 November 2026. Completed frontend modernization. GitHub publication status is recorded in the chat handoff; existing Git history and the legacy simulator are preserved.

Visual review: [homepage](MODERNIZATION_HOME.png) · [workspace](MODERNIZATION_WORKSPACE.png) · [periodic trends](MODERNIZATION_PERIODIC.png) · [independent orbitals](MODERNIZATION_COMPARISON.png) · [prepared configuration](MODERNIZATION_PREPARED.png).

## Repository audit and priorities

The existing application uses **Vite + strict TypeScript + native DOM components**,
plain CSS, **Three.js r181 / OrbitControls**, fragment-based routing, and a Python
HTTP/scientific backend. NumPy, SciPy and scikit-image provide analytic functions,
quadrature, sampling and meshes. Optional PySCF/job processes handle advanced
chemistry. A separate static build uses bounded browser workers and labeled
recorded datasets. There is no existing account service to migrate.

Inspected frontend entry/shell, routing, shared sessions, viewer lifecycle, API
cache, static-worker implementation, labs, Python configuration/species logic,
source snapshots/provenance, tests, build scripts and deployment documentation.
The legacy Pygame simulator remains unchanged.

The seven existing laboratory families already contain atomic, molecular,
spectroscopic, dynamics, experiments, computation and materials tools. Isotope
selection, ions, orbital meshes/clouds, overlays, playback in time-dependent labs,
model assumptions, exports, guided activities and per-lab parameter persistence
were implemented before this task. They were reused.

Prioritized checklist, completed:

- [x] Separate occupied ground-state controls from allowed-state exploration.
- [x] Verify 118-element configurations, exceptions, capacities and quantum validation.
- [x] Preserve and test direct links, refresh, Back/Forward and cancellation.
- [x] Preserve the bounded response cache and renderer reuse; lazy-load labs.
- [x] Add a homepage and a coherent responsive workspace with two themes.
- [x] Add command search, local experiment presets, sharing and atomic presentation controls.
- [x] Add a sourced timeline with side-by-side conceptual model comparison.
- [x] Verify local/static builds, science, browser behavior, accessibility and performance.

## Scientific findings and changes

The stored configuration for neutral hydrogen was already correct. The UI
exposed all orbital families without an explicit occupancy/exploration boundary,
and clicking an occupied subshell always chose basis index 0, which could be
empty for a partly occupied subshell. These presentation/selection errors were
corrected without replacing the science engine or inventing a new dataset.

**Ground state** is now the default. Its subshell buttons come directly from the
reference occupancy records. Shell, family, orientation and spin controls offer
only occupied reference boxes. Carbon's two occupied 2p boxes follow the bundled
Hund convention; their orientations are not claimed as a measured microstate.
Hydrogen exposes 1s¹; helium exposes 1s². A bare nucleus or unsupported ion
configuration clears the occupied density and explains why none is available.

**Explore allowed orbital states** exposes the supported n = 1…8, s/p/d/f states,
subject to quantum-number validation. It labels a state as occupied, unoccupied,
or unknown in the selected species' reference configuration. Selecting a shape
does not claim excitation or simulate a transition. Existing spectroscopy and
time-dependent laboratories remain the places to investigate those phenomena.
Old atomic URLs without a scope are treated as exploration links to preserve
their explicitly selected orbital.

All 118 configurations still use the bundled, documented NIST/PubChem data,
including exceptions and uncertainty labels. Neutral H–U/first-cation compilation:
[NIST](https://math.nist.gov/DFTdata/atomdata/configuration.html).
The existing lawrencium assignment is consistent with
[NIST's elemental entry](https://physics.nist.gov/cgi-bin/Elements/elInfo.pl?element=103).
See [data provenance](../data/SOURCES.md) for snapshots and heavy-element caveats.
The periodic-table dialog now previews configuration, category, period/group,
relative atomic mass and source status on focus/hover.

Hydrogenic functions remain one-electron Coulomb solutions under the existing
nonrelativistic assumptions. Many-electron Z_eff shapes remain explicitly
illustrative; no self-consistent many-electron atomic calculation was added.
Phase, nonnegative density, real-basis indices and definite magnetic quantum
numbers retain their distinctions. Orbital overlays remain individually
normalized illustrations, not electron-count-weighted many-electron densities.

## Interface and features

- New root overview with a live hydrogen 1s cloud, introductory content and tool
  previews. The homepage moves/reuses the atomic canvas; it creates no extra
  WebGL context. Existing lab URLs continue to open directly.
- Shared surface/text/interaction tokens, restrained green/ivory and dark
  palettes, persistent theme toggle, original serif homepage typography and
  consistent controls. The scientific viewport keeps a dark canvas in both themes.
- Desktop laboratory sidebar, a central viewport with properties/analysis,
  horizontal touch navigation, stacked narrow layouts and a native mobile
  **Atom & orbital controls** disclosure. Desktop panels scroll independently.
- Ctrl/Cmd+K command search for elements, laboratories and selected internal
  tools. Arrow/Enter/Escape behavior, combobox/listbox announcements and focus
  restoration are implemented.
- Shared experiment URL copy with a manual-copy fallback; atomic URL state now
  includes scope, prepared electron assignments, display controls, actual camera position/target, camera preset, and both occupied/subshell overlay choices.
- Device-local experiment shelf: up to 12 named route/parameter presets, restore
  and deletion, bounded validation and rejection of non-fragment stored links.
  Existing per-lab **Save parameters / Restore saved** controls remain available.
- x/y/z/perspective camera presets and presentation mode across the Three.js laboratories. Native fullscreen
  is used when available; CSS presentation is a fallback. Escape exits.
- Existing atomic PNG exports and laboratory scientific data/figure exports are
  preserved. Atomic quality now also caps device pixel ratio at 1.25/1.5/2 for
  preview/balanced/high. High quality can increase image resolution on high-DPI devices.
- Explicit calculation retry, module-import retry, persistent unsupported-WebGL
  explanation and source-loading failure text. Textual science remains accessible.
- Interactive `#lab=history` timeline and two conceptual model cards. Both
  selections survive refresh and can be shared in the URL. Historical diagrams
  are original schematic SVGs, not claimed trajectory simulations.

Existing hydrogenic spectra, molecular structure/SCF viewers, quantum experiments
and guide activities were retained and tested. They are not described as newly
implemented solvers.

## Routing and performance

Fragment routes work with the current Python server and static hosting without
new server rewrites. Invalid laboratory/tool IDs retain safe fallbacks. The new
homepage uses `#lab=home`; `#lab=atomic` is the explicit workspace entry point.
Atomic restoration now synchronizes basis/mode/phase controls and their visible
active states. Settings are restored after the selected species arrives, so a
previous element cannot clamp the new element's ground-state selection.

Laboratories now import on demand with a loading/retry state and a closed-lifetime
guard; an obsolete import cannot mount into the next laboratory. The existing
AbortControllers, revision checks, bounded caches, shared completed calculations,
two-context renderer policy and idle rendering were preserved. There was no
baseline evidence justifying a wholesale router or renderer rewrite.

The initial main JS asset changed from **706.05 kB / 190.74 kB gzip** to about
**630.02 kB / 171.18 kB gzip** after adding the features and splitting laboratory
code. Vite still reports a >500 kB warning because Three.js remains in the main
viewer bundle. No warning limit was increased to hide this.

Actual timing/memory observations are retained in
[before](MODERNIZATION_BEFORE.json) and [after](MODERNIZATION_AFTER.json).
The same four-pass workflow produced these observations:

| Observation | Before | Final |
| --- | ---: | ---: |
| First atomic result in a fresh browser page, warmed server | 156.3 ms | 142.5 ms |
| Median repeat module switch to completed result | 34.2 ms | 34.9 ms |
| Repeat-switch range (18 switches) | 28.6–41.1 ms | 27.5–59.0 ms |
| Long tasks during four passes | One, 52 ms | None observed |
| Retained post-GC JS heap change over three repeat passes | +118,148 B | +306,844 B |
| DOM-node change over the same passes | +6 | +6 |
| Page scroll width at 390 px | 390 px | 390 px |
| Browser exceptions | 0 | 0 |

Repeat navigation was already fast at baseline; these data do **not** establish
an across-the-board speedup. Initial main JS transfer size was reduced by about
10.3% gzip after adding the remaining tools. A first lazy-import implementation increased repeat median latency
to 60.8 ms ([intermediate observation](MODERNIZATION_IMPORT_PROFILE.json)); caching
the resolved mount function removed that extra asynchronous import step and
brought repeat switching back close to baseline. All observations are single
local runs, with normal timing noise and warmed scientific-server caches.

Run the same bounded workflow with:

```sh
.venv/bin/python run.py --port 8771
# In another terminal:
node scripts/profile_modernization.mjs /tmp/atomic-profile.json
```

These are local headless-Chrome observations, not a cross-device benchmark.
They measure navigation-to-completed-result wall time, >50 ms browser long tasks,
post-GC JS heap/DOM counters and a narrow-layout width check. They do not measure
total GPU/OS memory, cold internet downloads, physical phone GPU performance or
guarantee a frame rate. The existing 50-cycle browser regression separately checks
heap/DOM/listener bounds and at most two WebGL contexts.

## Verification

Actual commands and final results are recorded below; no lint script exists.
Type checking runs inside both builds.

| Check | Result |
| --- | --- |
| `.venv/bin/python -m unittest discover -s tests -v` | 139 passed |
| `npm --prefix frontend run test:science` | 5,356 existing checks + 2,457 new preparation/property checks passed |
| `npm --prefix frontend run build` | TypeScript + Vite passed |
| `npm --prefix frontend run build:pages` | Static build and packaging validation passed |
| Final UI regression rerun | 46 passed after screenshot-driven text/contrast corrections |
| Full local Chrome suite | 155 passed, including 50 original navigation cycles and new comparison/periodic stress checks |
| Static browser-demo suite | 16 passed against the API-free artifact |
| Linux/amd64 Docker build | Passed with shared reference snapshot included |
| Production container browser suite | 8 passed under 512 MiB / 1 CPU / read-only filesystem |
| `.venv/bin/python -m pip check` | No broken requirements |
| `git diff --check` | Passed |

New browser coverage includes default hydrogen/helium/carbon occupancy, chromium,
copper, iron, palladium, cerium and heavy-element labels, explicit unoccupied
exploration, bare ions, scope refresh, canvas reuse, presets/display restoration,
search keyboard behavior, invalid stored links, retry, fullscreen exit, history
restoration, denied storage and widths 320/390/768/1440. Axe WCAG rule checks cover
light/dark home, atomic, history, molecular and spectroscopy views, plus existing
lab/accessibility suites. Automated rules are not a formal accessibility certification.

The broad pass exposed a horizontally overflowing adaptive diagnostics block;
wrapping that JSON restored keyboard-accessible reading in the narrower shell.
The static test's old ambiguous partial search label was made dialog-scoped.
Screenshots were visually reviewed for desktop light/dark and mobile layouts.
The final source passed all 155 full-application browser workflows and all 16
static-demo workflows. Earlier checkpoints (143 full / 90 focused / 14 static)
were superseded by these complete runs. Shared cancellation/cache contracts also
passed `node scripts/test_frontend_lifecycle.mjs`.

## Completion of the remaining requested tools

- **Prepared / excited configurations:** the editor moves actual occupied spin
  orbitals, validates n/l/index/spin, preserves exactly Z−charge electrons, and
  rejects duplicate spin-orbital assignments. Prepared occupancies drive the
  orbital picker and diagrams and restore from shared URLs/presets. Reference
  ground states remain separate. Real-basis preparation is explicit; no optical
  transition or many-electron energy ordering is inferred.
- **Full periodic explorer:** `#lab=periodic` provides all 118 elements, category,
  period and name/symbol/Z filters, seven quantitative properties, point plots,
  source tables, CSV export, detailed metadata, and occupied-orbital links.
  Values come directly from the already bundled PubChem snapshot. Unknowns remain
  unknown; atomic radius is explicitly van der Waals radius in pm. The original
  quick periodic-table modal is retained.
- **Independent orbital comparison:** `#lab=compare` has two separately controlled
  camera panes, common physical or independent fit scales, clouds/surfaces,
  phase/density views, quantum numbers/nodes/reference occupancy, calculation
  quality, shareable parameters and camera restoration. A single renderer draws
  both scenes with scissoring; the second scene owns cloned GPU resources and
  does not create a third WebGL context alongside the persistent atomic viewer.
- **Workspace-wide 3D controls:** molecular, structure, field/dynamics, Bloch and
  comparison viewers receive display-quality, camera rotation/speed/pause,
  camera presets, fullscreen presentation, and 1×/2× PNG controls. Exports retain
  model/unit guidance, temporarily resize the render buffer, cap supersampling
  to 8 million rendered pixels / 8192 px edges, and restore its original size.
- **Complete settings persistence:** atomic camera position/target, prepared
  electron assignments, export scale and individual subshell visibility now
  restore. Other Three.js views persist camera/display/rotation state in their
  laboratory route. The right comparison camera has its own route state.
- **Guided learning:** new guide entries open periodic trends, independent
  orbital comparison and prepared hydrogen 2p. Molecular/field/RHF tours now
  encode their intended tool and parameters directly, so lazy imports cannot
  miss their setup or first start the wrong default calculation.

## Model scope and validation limits

These are scientific scope statements, not unfinished frontend placeholders:

- Hydrogenic functions are nonrelativistic one-electron Coulomb solutions.
  Many-electron Atomic Explorer / comparison Z_eff shapes remain explicitly
  illustrative. The existing chemistry engines provide their own HF/DFT models.
  No exact many-electron atomic or multi-electron spectrum claim is made.
- Preparing an assignment does not calculate relaxation, correlation, term
  structure or optical accessibility. Some redistributed assignments can be
  degenerate rather than higher in energy. Spectroscopy retains explicit
  hydrogenic selection rules and transition energies under its own model.
- Periodic properties are compiled values with heterogeneous conditions and
  definitions, sometimes estimates; source blanks and missing uncertainty
  metadata are not filled. Density depends on phase and conditions.
- Historical comparison uses sourced conceptual diagrams, with assumptions and
  limits. It is not a simulated classical-trajectory calculation.
- The experiment shelf stores bounded selections/settings locally, not complete
  solver results, accounts or cloud workspaces. Exports are bounded raster
  images, not an unlimited poster renderer.
- Automated accessibility and responsive Chrome checks are not a certification
  or a claim that every OS/browser/GPU/screen reader/physical phone was tested.
- Existing advanced static-demo restrictions remain explicit. No paid service,
  external runtime asset, dependency installation or new backend was added.

## Files and dependencies

Added: `frontend/src/app/home.ts`, `frontend/src/app/workspace-tools.ts`,
`frontend/src/science/occupancy.ts`, `frontend/src/labs/history.ts`,
`frontend/src/modern.css`, `frontend/tests/modernization.spec.ts`,
`scripts/profile_modernization.mjs`, `scripts/test_frontend_science.mjs`,
`frontend/src/components/configuration-editor.ts`,
`frontend/src/science/prepared-configuration.ts`,
`frontend/src/science/element-properties.ts`,
`frontend/src/labs/periodic.ts`, `frontend/src/labs/orbital-comparison.ts`,
`frontend/src/visualization/viewport-tools.ts`, `frontend/tests/completion.spec.ts`,
this report and measurement/screenshot artifacts.

Modified: `Dockerfile` (copy the shared source snapshot into the frontend build stage), `README.md`, `frontend/package.json` (science-test command), `frontend/src/main.ts`, `frontend/src/app/route.ts`,
`frontend/src/app/navigation.ts`, `frontend/src/styles.css`,
`frontend/src/types.ts`, `frontend/src/visualization/viewer.ts`, and existing
browser specs to use the explicit atomic route and opt into exploration when
testing arbitrary hydrogen orbitals. No files were removed. No dependencies
were added; package/lock files and scientific datasets are unchanged.

## Run, build and deployment

With the already installed dependencies:

```sh
npm --prefix frontend run build
.venv/bin/python run.py
```

Open `http://127.0.0.1:8765/`. For development, run the Python server on 8765 and
`npm --prefix frontend run dev` in another terminal; Vite proxies `/api`.
`npm --prefix frontend run build:pages` produces `frontend/dist-pages` for the
existing API-free hosting workflow. `npm --prefix frontend run preview:pages`
previews it locally on 8770. Use the existing README for a clean-machine install
and optional computation packages.

The review branch is `codex/frontend-modernization`, based on the existing
`codex/cloudflare-pages-demo` branch. The owner explicitly requested a GitHub
update. A dedicated review branch preserves the auto-publishing branch and keeps
this change out of the existing production publishing workflow. No merge or
manual deployment is part of this update. The chat handoff gives the verified
remote commit and pull-request link. For subsequent approved publication, use
the existing Cloudflare workflow. Upload the entire
matching artifact including the new dynamic JS chunks; preserve its CSP,
worker policy, immutable hashed assets and entry-page cache rules. Existing hash
deep links need no new fallback configuration. The Python-hosted build still
requires its scientific API; the static build retains its documented reduced
scope. Git history and the legacy simulator are preserved; the completed update is prepared as a reviewable Git commit.

## Design and history references

Public pages were consulted, not source code copied:
[TryClean](https://www.tryclean.ai), [MolView](https://molview.com/),
[Ptable](https://ptable.com/), [PhET](https://phet.colorado.edu/),
[Geist](https://vercel.com/geist/introduction), [shadcn/ui](https://ui.shadcn.com/),
[21st](https://21st.dev/), [Motion](https://motion.dev/).
PhET exposed only limited page content. React-oriented component catalogs would
add unnecessary dependencies to this native-DOM app; native controls, CSS and
the existing dialog were reused. No proprietary illustrations, branding,
templates or third-party component code were imported.

Timeline references are linked in each card: the RSC Dalton chronology,
[Thomson's 1904 paper](https://doi.org/10.1080/14786440409463107),
[AIP's Rutherford exhibit](https://history.aip.org/exhibits/rutherford/),
[Niels Bohr Institute history](https://nbi.ku.dk/english/www/institute/history/the_copenhagen_interpretation),
and [Schrödinger's 1926 paper](https://journals.aps.org/pr/abstract/10.1103/PhysRev.28.1049).
Some full publisher pages blocked retrieval; publication metadata and accessible
institutional/search records were used, without claiming access to full papers.

## Added property-data provenance

The periodic explorer imports the original retained
`data/sources/pubchem-periodic-table.json` snapshot directly. No fresh values
were generated. Definitions were checked against
[PubChem atomic radius](https://pubchem.ncbi.nlm.nih.gov/periodic-table/atomic-radius)
and the [IUPAC FAIR Chemistry Cookbook](https://iupac.github.io/WFChemCookbook/datasources/pubchem_ptable.html).
The same factual source data are bundled in both local and static builds.
Scientific tests compare every included property against every source row,
including blanks.
