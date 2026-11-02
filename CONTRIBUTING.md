# Contributing

Use Python 3.14 and Node 24 with the existing NumPy/SciPy/TypeScript/Three.js
stack. Install `requirements.txt`, optionally `requirements-computation.txt`,
then `npm --prefix frontend ci` and build. Start with `python run.py`; preserve
`python main.py` and the original Pygame modules. Do not downgrade a working
scientific environment to work around an optional package without evidence.

Create a `codex/` or focused feature branch from the current appropriate head.
While PR #2 is unmerged, stack follow-ups rather than starting from old main.
Do not merge, force-push, rewrite unrelated history, publish packages or choose
an owner license as an incidental part of an implementation change.

Deliver one working engine/API/UI/test milestone per coherent commit/PR.
Preserve reference vs calculated labels, units, scientific assumptions and real
failure/convergence handling. Do not add placeholder pages or substitute
interpolated animations for calculations. Keep optional imports lazy, catalog
inputs strict and local workloads bounded. Direct SDK and application-job
resource behavior differ and must remain documented.

Before submitting:

```sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m pip check
npm --prefix frontend run build
npm --prefix frontend run test:e2e
.venv/bin/python scripts/benchmark3.py
```

For independent work, set `QAL_TEST_URL=http://127.0.0.1:8766` and start a server
on that port. Scientific methods need independent reference/limiting cases,
convergence studies, invalid-input coverage and explicit approximations.
Keep tolerances tied to physical/numerical error, not arbitrary snapshots.
Browser tests exercise actual workflows and failures; inspect real screenshots
at desktop/tablet/mobile widths and retain textual results if WebGL fails.

Packaging changes must pass standalone-wheel verification. Sync bundled data
and retain provenance. Update the feature audit, methodology, limitations,
performance and changelog for actual behavior. Report skipped/unavailable
methods honestly. CI configuration does not prove a hosted run passed.

There is currently no approved project open-source license. See
`docs/LICENSE_REVIEW.md`; contributions do not authorize a license decision.
