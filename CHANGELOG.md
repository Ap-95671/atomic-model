# Changelog

## Railway deployment preparation (not publicly deployed)

- Independent Linux Docker build, pinned Node/Python images and production deps.
- Uvicorn public gateway, strict core-workload limits, cache/rate/time/RSS limits,
  same-origin assets, health/PORT support, and advanced-local explanations.
- Preserved all advanced local APIs; added Docker/public-browser CI and real
  production-mode smoke/export/mobile checks.
- Authenticated Railway account requires paid upgrade; free/trial-only budget
  prevents activation. No cloud service/domain was created and no paid plan chosen.

## 3.0.0a1 — incremental, unmerged development milestones

- Spin-aware RHF/UHF/ROHF/DFT molecule selection, all alpha/beta orbitals and
  density fields, cc-pVDZ, O2 spin checks, SCF/decomposition diagnostics.
- Optimizable H2+ Slater exponent and measured mesh accuracy; real bounded job
  progress/cancellation, accumulating/resettable measurements, stale atomic labels.
- Analytic-gradient geometry optimization and harmonic normal modes with
  convergence checks, structure overlays, mode playback and exports.
- Bounded MP2/CCSD/(T)/CISD/FCI/CASCI/CASSCF, singlet electronic response/NTO
  data, computed same-basis H2 dissociation comparisons.
- General well and n≤2 atomic spectral evolution, Lindblad qubit dynamics,
  ideal circuits, H2 Jordan–Wigner VQE, analytic tight-binding models.
- Experimental standalone Python SDK, generated-data benchmarks, transparent
  evidence-limited method lookup, CI definitions and contribution/public-demo docs.

This alpha does not complete the full 3.0 specification. No stable release tag,
PyPI publication, project-license choice or merge into main was performed.

## 2.0 — PR #2 (preserved)

Atomic explorer, molecular reference/calculated foundations, measurement,
tunneling, spectroscopy, weak fields, original RHF/optional fixed-geometry DFT,
responsive UI and validated core/browser suites. See `docs/RELEASE_AUDIT.md`.

## 1.0

Original Pygame comparison preserved in main and the project history.
