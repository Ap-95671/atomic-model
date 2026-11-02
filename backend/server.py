"""Local read-only JSON API + compiled frontend, using Python's standard library."""
import argparse
import json
import mimetypes
import threading
import traceback
import numpy as np
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from quantum_engine import QuantumState
from quantum_engine.atomic_structure import species
from quantum_engine.electron_configuration import ELEMENTS
from quantum_engine.energy_levels import energy_ev, transition
from .geometry import orbital_payload
from .api.experiments import calculate

ROOT = Path(__file__).resolve().parents[1]
COMPUTE = threading.BoundedSemaphore(2)


def integer(q, key, default):
    return int(q.get(key, [str(default)])[0])


def floating(q, key, default):
    return float(q.get(key, [str(default)])[0])


def atom_from_query(q):
    return species(integer(q, "z", 1), integer(q, "a", None) if "a" in q else None, integer(q, "charge", 0))


class ScientificJSONEncoder(json.JSONEncoder):
    def default(self, value):
        if isinstance(value, np.ndarray):
            return value.tolist()
        if isinstance(value, np.generic):
            return value.item()
        return super().default(value)


class Handler(BaseHTTPRequestHandler):
    def send_data(self, status, data, content_type="application/json; charset=utf-8"):
        body = json.dumps(data, allow_nan=False, separators=(",", ":"), cls=ScientificJSONEncoder).encode() if not isinstance(data, bytes) else data
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        url = urlsplit(self.path)
        q = parse_qs(url.query)
        try:
            if url.path == "/api/health":
                return self.send_data(200, {"status": "ok", "engine": "Schrödinger hydrogenic", "elements": len(ELEMENTS)})
            if url.path == "/api/elements":
                return self.send_data(200, ELEMENTS)
            if url.path == "/api/species":
                return self.send_data(200, atom_from_query(q))
            if url.path == "/api/orbital":
                state = QuantumState(integer(q, "n", 1), integer(q, "l", 0), integer(q, "m", 0),
                    floating(q, "spin", 0.5), q.get("basis", ["real"])[0])
                if not COMPUTE.acquire(blocking=False):
                    return self.send_data(503, {"error": "Two geometry jobs are running; please retry shortly."})
                try:
                    payload = orbital_payload(state, atom_from_query(q), mode=q.get("mode", ["cloud"])[0],
                        quality=q.get("quality", ["balanced"])[0], point_count=integer(q, "points", 0),
                        threshold=floating(q, "threshold", 0.06), show_nodes=q.get("nodes", ["false"])[0] == "true",
                        effective_z=floating(q, "zeff", 1.0))
                finally:
                    COMPUTE.release()
                return self.send_data(200, payload)
            if url.path in ("/api/spectroscopy", "/api/spectroscopy/transition", "/api/spectroscopy/series", "/api/measurement"):
                if not COMPUTE.acquire(blocking=False):
                    return self.send_data(503, {"error": "Two scientific calculations are running; retry shortly."})
                try:
                    payload = calculate(url.path, q, atom_from_query(q))
                finally:
                    COMPUTE.release()
                return self.send_data(200, payload)
            if url.path == "/api/energy":
                atom = atom_from_query(q)
                if not atom["one_electron"]:
                    raise ValueError("Hydrogenic energies are available only for one-electron species")
                ni, nf = integer(q, "initial", 3), integer(q, "final", 2)
                if not 1 <= ni <= 30 or not 1 <= nf <= 30:
                    raise ValueError("Transition levels must be 1…30")
                return self.send_data(200, {"levels": [energy_ev(n, atom["z"], atom["nuclear_mass_u"]) for n in range(1, 9)],
                    **transition(ni, nf, atom["z"], atom["nuclear_mass_u"])})
            if url.path.startswith("/api/"):
                return self.send_data(404, {"error": "Unknown API endpoint"})
            dist = ROOT/"frontend/dist"
            relative = unquote(url.path).lstrip("/") or "index.html"
            target = (dist/relative).resolve()
            if not target.is_relative_to(dist.resolve()):
                return self.send_data(403, {"error": "Forbidden path"})
            if not target.is_file():
                return self.send_data(404, {"error": "Frontend not found. Run npm install && npm run build inside frontend/."})
            return self.send_data(200, target.read_bytes(), mimetypes.guess_type(target)[0] or "application/octet-stream")
        except (ValueError, TypeError, OverflowError) as exc:
            self.send_data(400, {"error": str(exc)})
        except Exception:
            traceback.print_exc()
            self.send_data(500, {"error": "Unexpected calculation error; see the backend terminal."})


def serve():
    parser = argparse.ArgumentParser(description="Quantum Atom Lab — local API and frontend")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    print(f"Quantum Atom Lab: http://127.0.0.1:{args.port}", flush=True)
    print("Local-only; Ctrl+C to stop. Legacy comparison: python main.py", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    serve()
