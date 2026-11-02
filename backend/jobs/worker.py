"""Fixed JSON-line protocol worker; no user code or shell commands are accepted."""
import json
import resource
import sys
import time
import numpy as np
from quantum_engine.chemistry.models import ChemistryRequest


def encode(value):
    return value.tolist() if isinstance(value, np.ndarray) else value.item()


def emit(event):
    print(json.dumps(event, allow_nan=False, default=encode, separators=(",", ":")), flush=True)


def run(payload):
    from quantum_engine.chemistry.scf import field, solve
    request = ChemistryRequest.parse(payload["request"])
    progress = lambda data: emit({"event": "progress", "data": data})
    started = time.perf_counter()
    before = resource.getrusage(resource.RUSAGE_SELF)
    if payload["operation"] == "scf":
        result, solution = solve(request, progress)
    elif payload["operation"] in ("optimize", "vibrations"):
        from quantum_engine.chemistry.geometry import optimize, GeometryOptions
        result, solution = optimize(request, GeometryOptions.parse(payload.get("options", {})), progress, vibrations=payload["operation"] == "vibrations")
    elif payload["operation"] in ("correlation", "excitations", "bond_scan"):
        from quantum_engine.chemistry.correlated import correlation, excitations, bond_scan, CorrelationOptions, ExcitationOptions
        if payload["operation"] == "correlation":
            result, solution = correlation(request, CorrelationOptions.parse(payload.get("options", {})), progress)
        elif payload["operation"] == "excitations":
            result, solution = excitations(request, ExcitationOptions.parse(payload.get("options", {})), progress)
        else:
            result, solution = bond_scan(request, progress)
    elif payload["operation"] == "field" and payload.get("solution"):
        solution = payload["solution"]
        result = dict(solution["result"])
    else:
        raise ValueError("Unsupported worker operation")
    result = {**result, "field": field(solution, request, progress)}
    after = resource.getrusage(resource.RUSAGE_SELF)
    result["resources"] = {"wall_seconds": time.perf_counter()-started,
                           "cpu_seconds": after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime,
                           "peak_rss_mib": after.ru_maxrss/(1024**2 if sys.platform == "darwin" else 1024)}
    emit({"event": "result", "result": result, "solution": solution if payload["operation"] != "field" else None})


if __name__ == "__main__":
    try:
        run(json.loads(sys.stdin.read(2_000_000)))
    except Exception as exc:
        emit({"event": "error", "message": str(exc)})
        sys.exit(1)
