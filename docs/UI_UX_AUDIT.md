# Interface audit and corrections

Baseline screenshots and measurements are in `BASELINE_AUDIT.md`.

The first implementation milestone extracts API requests, dialog lifecycle,
SVG graph rendering and laboratory navigation from the atomic controller.
The atomic workspace, gallery, periodic table, overlays and inspector remain.
During the foundation milestone, unavailable laboratories were marked planned
and disabled. The integrated release now implements all seven navigation areas;
scientific scopes remain explicit.

Corrections verified by the browser suite:

- Responsive grid columns can shrink; at ≤420 px the atomic controls use a
  single column instead of squeezing two form columns. No document overflow
  at tested widths 320, 390, 768, 1024, 1440 and 1920 px.
- Mobile form/help text is enlarged; action targets and analysis tabs have
  practical touch heights. Long equations wrap; tab/nav strips scroll locally.
- Analysis tabs support arrows, Home/End, roving focus, selected state and an
  associated panel. A skip link reaches the visualization.
- Native dialog close returns focus, including Escape. Existing modal Tab
  confinement remains native. Nested content refresh preserves the invoker.
- The atomic transition panel rejects obsolete success **and error** responses
  by species, panel revision and request identity.
- Requests have a 30-second timeout and abort support; geometry-capacity
  errors leave controls usable. No global unbounded automatic retry is added.
- WebGL failure still loads textual scientific results and species controls.
- Viewport exports include model, length units and display assumptions.

Rendering now schedules frames on data/camera changes, pauses hidden views,
reuses color attributes, and releases axis geometry/materials/textures during
disposal. Reduced motion disables automatic rotation and camera damping.
This is targeted engineering, not a claim of a full WCAG conformance audit.

Automated browser checks use installed Chrome via Playwright; run after a
production build with `cd frontend && npm run test:e2e`. No cloud service or
browser binary download is necessary on the validated Mac.

The later scientific labs provide visible request progress/errors, versioned
local save/restore/defaults, model-labeled CSV and graph PNG exports. Parameter
changes hide obsolete results immediately. Plot/table overflow is contained
within labeled panels. Live dynamics separates amplitude, density and potential
axes and holds time-dependent density/amplitude scales fixed. Playback starts
paused, supports keyboard scrubbing, caps redraws at 10 Hz and stops on lab
switch, input changes or document hiding. Tunneling distinguishes early incident
probability from a final reflected fraction and exposes numerical warnings.

Final integration adds guided activities using live engines, calculation JSON
exports, source-linked molecular geometry, reference MO occupations, optional
DFT and same-geometry HF comparison. Mobile experiment settings collapse behind
a native disclosure; local tool navigation scrolls horizontally, keeping the
active visualization closer to the first screen. Classical comparison remains
keyboard-accessible through the compact ↗ action on mobile.

Axe WCAG 2.2 AA rule checks found low contrast in eight original label/footer
locations; explicit muted-text colors fix those failures. Six main workspaces
now have zero violations for the tested automated rules. Named dialogs, main
landmarks and state-button pressed values were added. This remains an automated
rule audit, not formal accessibility certification. Manual visual QA uses the
actual screenshots included with the release.

## 3.0 alpha integration

The existing visual design is retained. Molecular subnavigation now exposes
calculated systems beyond H2+, geometry and vibrations; computed/reference
labels remain distinct. Computational tools group correlation, excitations,
spin-aware orbitals and evidence selection. Dynamics keeps the original demo
and adds finite/atomic evolution. Quantum experiments group measurement,
tunneling, fields, Lindblad and circuits/VQE; materials has a separate route.
Only one controller/viewer is mounted per tool.

Corrected reproducible issues: retained atomic failures lacked a clear stale
label; measurement batches could not accumulate/reset; expensive requests had
no true running-worker cancellation; NIST inline link relied on color; adaptive
tolerance default violated its HTML step. Textarea controls now match theme and
width, and presets retain longer bounded JSON parameters. Input changes stop
playback and invalidate results. Wavefunction phase, density, harmonic playback,
reference surfaces and user-parameter material models have explicit legends.

All 85 browser workflows pass, including all original 51 and new geometry,
correlation/response, atomic/Open Systems, circuits/VQE/materials, adaptive
abstention and ten new representative axe screens. New responsive checks cover
320/768/1440 px; preserved atomic tests extend to 1920 px. Automated coverage
is not a claim that all UI/device/assistive-technology defects are eliminated.

Actual images captured and manually inspected:

| Before | After |
| --- | --- |
| `quantum-lab-2-molecular.png` (H2+ only direct calculated tool) | `quantum-lab-3-molecular.png` (triplet O2, full calculated selector) |
| `quantum-lab-2-mobile.png` | `quantum-lab-3-mobile.png` (390 px material model/viewport) |
| No geometry/vibration tool | `quantum-lab-3-vibrations.png` (optimized water, force/energy history) |
| Original two-state well only | `quantum-lab-3-atomic-dynamics.png` (calculated 3D density/phase) |

These are real Chrome screenshots, not design mockups. Desktop views preserve
readable scientific controls and a dominant 3D viewport; mobile controls collapse
and charts/tables scroll locally. Browser audit found zero console errors and
no new GPU buffers during the measured atomic playback interval. Further full
camera/overlay/device testing, named portable workspaces and code splitting
remain incomplete.
