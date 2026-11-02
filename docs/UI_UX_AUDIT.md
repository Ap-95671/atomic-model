# Interface audit and corrections

Baseline screenshots and measurements are in `BASELINE_AUDIT.md`.

The first implementation milestone extracts API requests, dialog lifecycle,
SVG graph rendering and laboratory navigation from the atomic controller.
The atomic workspace, gallery, periodic table, overlays and inspector remain.
Unavailable laboratories are explicitly marked planned and disabled; they do
not pretend to be functioning calculations.

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
