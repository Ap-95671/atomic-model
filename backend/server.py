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
from .jobs import JobManager
from quantum_engine.chemistry import catalog
from .api.experiments import calculate
from .optional_computation import compute as optional_compute
from quantum_engine.molecular.structures import structure
from quantum_engine.molecular.diagrams import diagram
from .molecular_geometry import molecule_payload, hartree_fock_payload

ROOT = Path(__file__).resolve().parents[1]
COMPUTE = threading.BoundedSemaphore(2)
JOBS = JobManager(COMPUTE)


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


class LocalHTTPServer(ThreadingHTTPServer):
    """Bound handler lifetimes as well as scientific compute concurrency."""
    daemon_threads = True
    max_handlers = 16
    request_queue_size = 16

    def __init__(self, *args, **kwargs):
        self.handler_slots = threading.BoundedSemaphore(self.max_handlers)
        super().__init__(*args, **kwargs)

    def process_request(self, request, client_address):
        request.settimeout(30)
        if not self.handler_slots.acquire(blocking=False):
            body = b'{"error":"Local server capacity reached; retry shortly."}'
            try:
                request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Type: application/json\r\nConnection: close\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n'+body)
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.handler_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.handler_slots.release()


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

    def local_mutation_allowed(self):
        origin = self.headers.get("Origin")
        if origin and urlsplit(origin).hostname not in ("127.0.0.1", "localhost", "::1"):
            self.send_data(403, {"error": "Scientific job changes require a local origin"})
            return False
        return True

    def do_POST(self):
        if not self.local_mutation_allowed():
            return
        if urlsplit(self.path).path != "/api/jobs":
            return self.send_data(404, {"error": "Unknown job endpoint"})
        try:
            if self.headers.get_content_type() != "application/json":
                return self.send_data(415, {"error": "Use application/json"})
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 32768:
                return self.send_data(413, {"error": "JSON request must be 1…32768 bytes"})
            def invalid_constant(value):
                raise ValueError("Nonfinite JSON numbers are not accepted")
            body = json.loads(self.rfile.read(length), parse_constant=invalid_constant)
            return self.send_data(202, JOBS.submit(body))
        except KeyError as exc:
            return self.send_data(410, {"error": str(exc)})
        except (ValueError, TypeError, OverflowError) as exc:
            return self.send_data(400, {"error": str(exc)})
        except RuntimeError as exc:
            return self.send_data(503, {"error": str(exc)})

    def do_DELETE(self):
        if not self.local_mutation_allowed():
            return
        path = urlsplit(self.path).path
        if not path.startswith("/api/jobs/"):
            return self.send_data(404, {"error": "Unknown job endpoint"})
        try:
            return self.send_data(200, JOBS.cancel(path.removeprefix("/api/jobs/")))
        except KeyError as exc:
            return self.send_data(404, {"error": str(exc)})

    def do_GET(self):
        url = urlsplit(self.path)
        q = parse_qs(url.query)
        try:
            if url.path == "/api/chemistry/catalog":
                return self.send_data(200, catalog())
            if url.path.startswith("/api/jobs/"):
                try:
                    return self.send_data(200, JOBS.get(url.path.removeprefix("/api/jobs/")))
                except KeyError as exc:
                    return self.send_data(404, {"error": str(exc)})
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
            if url.path == "/api/molecular/diagram":
                return self.send_data(200,diagram(q.get("name",["o2"])[0]))
            if url.path == "/api/molecular/structure":
                return self.send_data(200,structure(q.get("name",["water"])[0]))
            if url.path == "/api/computation/pyscf":
                if not COMPUTE.acquire(blocking=False):
                    return self.send_data(503, {"error": "Two scientific calculations are running; retry shortly."})
                try:
                    system, method, basis, view = (q.get(k,[v])[0] for k,v in (("system","water"),("method","pbe"),("basis","sto-3g"),("view","homo")))
                    payload = optional_compute(system,method,basis,view)
                    if q.get("compare",["false"])[0] == "true":
                        reference = optional_compute(system,"hf",basis,view)
                        payload = {**payload,"hf_reference_total_energy_hartree":reference["total_energy_hartree"]}
                except RuntimeError as exc:
                    return self.send_data(503,{"error":str(exc)})
                finally:
                    COMPUTE.release()
                return self.send_data(200,payload)
            if url.path == "/api/computation/hartree-fock":
                if not COMPUTE.acquire(blocking=False):
                    return self.send_data(503, {"error": "Two scientific calculations are running; retry shortly."})
                try:
                    payload = hartree_fock_payload(q.get("system",["h2"])[0],floating(q,"distance",1.4),q.get("basis",["sto-3g"])[0],q.get("view",["density"])[0])
                finally:
                    COMPUTE.release()
                return self.send_data(200,payload)
            if url.path == "/api/molecular":
                if not COMPUTE.acquire(blocking=False):
                    return self.send_data(503, {"error": "Two scientific calculations are running; retry shortly."})
                try:
                    payload = molecule_payload(floating(q,"distance",2.),q.get("orbital",["bonding"])[0],floating(q,"threshold",.12),floating(q,"exponent",1.),q.get("optimize",["false"])[0]=="true",q.get("quality",["balanced"])[0])
                finally:
                    COMPUTE.release()
                return self.send_data(200,payload)
            if url.path in ("/api/spectroscopy", "/api/spectroscopy/transition", "/api/spectroscopy/series", "/api/measurement", "/api/dynamics/superposition", "/api/tunneling", "/api/fields"):
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
    server = LocalHTTPServer(("127.0.0.1", args.port), Handler)
    server.daemon_threads = True
    print(f"Quantum Atom Lab: http://127.0.0.1:{args.port}", flush=True)
    print("Local-only; Ctrl+C to stop. Legacy comparison: python main.py", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        JOBS.close()
        server.server_close()


if __name__ == "__main__":
    serve()
