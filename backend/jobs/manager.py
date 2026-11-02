"""Two bounded worker lifetimes, progress, timeout and true process cancellation."""
from collections import OrderedDict, deque
from concurrent.futures import ThreadPoolExecutor
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from typing import Any
from quantum_engine.chemistry.models import ChemistryRequest

ROOT = Path(__file__).resolve().parents[2]
TERMINAL = {"succeeded", "failed", "cancelled", "timed_out"}


class JobManager:
    def __init__(self, compute_slots: threading.BoundedSemaphore, timeout: float = 90):
        self.slots = compute_slots
        self.timeout = timeout
        self.executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="chemistry-job")
        self.lock = threading.RLock()
        self.records: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self.solutions: OrderedDict[str, dict] = OrderedDict()

    def submit(self, data: Any) -> dict:
        if not isinstance(data, dict) or set(data)-{"operation", "request", "calculation_id", "options"}:
            raise ValueError("Expected operation, request and optional calculation_id")
        operation = data.get("operation", "scf")
        if operation not in ("scf", "field", "optimize", "vibrations", "correlation", "excitations", "bond_scan"):
            raise ValueError("Unsupported job operation")
        from quantum_engine.chemistry.geometry import GeometryOptions
        from quantum_engine.chemistry.correlated import CorrelationOptions, ExcitationOptions
        option_type = {"optimize": GeometryOptions, "vibrations": GeometryOptions,
                       "correlation": CorrelationOptions, "excitations": ExcitationOptions}.get(operation)
        if option_type:
            options = option_type.parse(data.get("options", {})).__dict__
        else:
            if data.get("options"):
                raise ValueError("This operation has no calculation options")
            options = {}
        solution = None
        source_id = data.get("calculation_id")
        if operation == "field":
            if not isinstance(source_id, str):
                raise ValueError("A completed calculation_id is required")
            with self.lock:
                solution = self.solutions.get(source_id)
            if solution is None:
                raise KeyError("Calculated state expired or unavailable; recalculate the molecule")
            overrides = data.get("request", {})
            if not isinstance(overrides, dict) or set(overrides)-{"view", "orbital", "channel", "quality", "threshold"}:
                raise ValueError("Field requests may change only view, orbital, channel, quality and threshold")
            request = ChemistryRequest.parse({**solution["request"], **overrides})
        else:
            request = ChemistryRequest.parse(data.get("request", {}))
        if importlib.util.find_spec("pyscf") is None:
            raise RuntimeError("Optional PySCF unavailable. Install requirements-computation.txt; core labs remain available.")
        if not self.slots.acquire(blocking=False):
            raise RuntimeError("Two scientific jobs are active; cancel one or retry shortly")
        job_id = uuid.uuid4().hex
        with self.lock:
            self.records[job_id] = {"id": job_id, "operation": operation, "status": "queued",
                                    "stage": "Queued", "created": time.monotonic(), "progress": deque(maxlen=100),
                                    "request": request.to_dict(), "options": options, "cancel_requested": False, "process": None,
                                    "calculation_id": source_id or job_id}
            while len(self.records) > 16:
                old = next((key for key, value in self.records.items() if value["status"] in TERMINAL), None)
                if old is None:
                    break
                self.records.pop(old)
        try:
            self.executor.submit(self._run, job_id, request, solution)
        except BaseException:
            self.slots.release()
            with self.lock:
                self.records.pop(job_id, None)
            raise
        return self.get(job_id)

    def get(self, job_id: str) -> dict:
        with self.lock:
            record = self.records.get(job_id)
            if record is None:
                raise KeyError("Job expired or not found")
            public = {key: record[key] for key in ("id", "operation", "status", "stage", "request", "calculation_id")}
            public["elapsed_seconds"] = record.get("finished", time.monotonic())-record["created"]
            public["progress"] = list(record["progress"])
            if "result" in record:
                public["result"] = record["result"]
            if "error" in record:
                public["error"] = record["error"]
            return public

    def cancel(self, job_id: str) -> dict:
        with self.lock:
            record = self.records.get(job_id)
            if record is None:
                raise KeyError("Job expired or not found")
            if record["status"] not in TERMINAL:
                record["cancel_requested"] = True
                record["status"] = "cancelling"
                record["stage"] = "Stopping calculation process"
                process = record["process"]
                if process is not None and process.poll() is None:
                    process.kill()
        return self.get(job_id)

    def _run(self, job_id: str, request: ChemistryRequest, solution: dict | None):
        timer = None
        process = None
        timed_out = threading.Event()
        outcome: dict[str, Any] = {}
        with self.lock:
            record = self.records[job_id]

        def timeout():
            with self.lock:
                if process is not None and process.poll() is None:
                    timed_out.set()
                    process.kill()

        try:
            with tempfile.TemporaryDirectory(prefix="quantum-job-") as scratch:
                env = dict(os.environ, TMPDIR=scratch, OMP_NUM_THREADS="1", OPENBLAS_NUM_THREADS="1",
                           MKL_NUM_THREADS="1", VECLIB_MAXIMUM_THREADS="1")
                # stderr cannot block stdout progress, and is kept within this job's scratch lifetime.
                with open(Path(scratch)/"stderr.log", "w+") as errors:
                    with self.lock:
                        if record["cancel_requested"]:
                            return
                        process = subprocess.Popen([sys.executable, "-m", "backend.jobs.worker"], cwd=ROOT, env=env,
                                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=errors, text=True)
                        record.update(process=process, status="running", stage="Starting scientific engine")
                    timer = threading.Timer(self.timeout, timeout)
                    timer.daemon = True
                    timer.start()
                    payload = {"operation": record["operation"], "request": request.to_dict(), "solution": solution, "options": record["options"]}
                    process.stdin.write(json.dumps(payload, allow_nan=False))
                    process.stdin.close()
                    final = None
                    for line in process.stdout:
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        with self.lock:
                            if record["cancel_requested"] or timed_out.is_set():
                                continue
                            if event.get("event") == "progress":
                                record["progress"].append(event["data"])
                                record["stage"] = event["data"].get("stage", record["stage"])
                            elif event.get("event") == "result":
                                final = event
                            elif event.get("event") == "error":
                                record["error"] = event.get("message", "Calculation failed")
                    process.wait(timeout=5)
                    with self.lock:
                        if record["cancel_requested"]:
                            outcome.update(status="cancelled", stage="Cancelled; process stopped")
                        elif timed_out.is_set():
                            outcome.update(status="timed_out", stage="Time limit reached",
                                          error=f"Calculation exceeded {self.timeout:g} seconds; worker terminated")
                        elif final is None or process.returncode:
                            outcome.update(status="failed", stage="Calculation failed")
                            record.setdefault("error", "Scientific worker failed without a valid result")
                        else:
                            outcome.update(status="succeeded", stage="Calculation complete", result=final["result"])
                            if final.get("solution"):
                                self.solutions[job_id] = final["solution"]
                                while len(self.solutions) > 4:
                                    self.solutions.popitem(last=False)
        except Exception as exc:
            if process is not None and process.poll() is None:
                process.kill()
                process.wait()
            with self.lock:
                outcome.update(status="cancelled" if record["cancel_requested"] else "failed", stage="Calculation stopped", error=str(exc))
        finally:
            if timer is not None:
                timer.cancel()
            if process is not None:
                for stream in (process.stdin, process.stdout):
                    if stream is not None and not stream.closed:
                        stream.close()
            with self.lock:
                if record["cancel_requested"]:
                    outcome.update(status="cancelled", stage="Cancelled; process stopped")
                self.slots.release()
                record.update(outcome)
                record["finished"] = time.monotonic()
                record["process"] = None

    def close(self):
        with self.lock:
            for key in list(self.records):
                self.cancel(key)
        self.executor.shutdown(wait=True, cancel_futures=False)
