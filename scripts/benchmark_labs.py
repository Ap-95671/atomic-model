"""Reproducible single-run lab timings, CPU and process peak RSS; no speedup claim."""
import importlib.util
import resource
import sys
import time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from quantum_engine import QuantumState
from quantum_engine.spectroscopy import electric_dipole
from quantum_engine.measurement import measurement
from quantum_engine.dynamics import superposition
from quantum_engine.dynamics.tunneling import propagate
from backend.molecular_geometry import molecule_payload,hartree_fock_payload


def run(label,fn):
    before=resource.getrusage(resource.RUSAGE_SELF);start=time.perf_counter()
    result=fn();elapsed=time.perf_counter()-start;after=resource.getrusage(resource.RUSAGE_SELF)
    rss=after.ru_maxrss/(1024**2 if sys.platform=='darwin' else 1024)
    cpu=(after.ru_utime+after.ru_stime)-(before.ru_utime+before.ru_stime)
    print(f'{label}: wall={elapsed:.4f}s; CPU={cpu:.4f}s; parent peak RSS={rss:.1f} MiB',flush=True)
    return result


if __name__=='__main__':
    run('State-resolved dipole',lambda:electric_dipole(QuantumState(3,1,0,.5,'complex'),QuantumState(2,0,0,.5,'complex')))
    run('60000 2p measurements',lambda:measurement(QuantumState(2,1),60000))
    run('Exact well basis',superposition)
    run('1024-cell tunneling / 3000 steps',propagate)
    run('H2+ antibonding mesh + 121-point energy curve',lambda:molecule_payload(2,'antibonding'))
    run('H2 RHF density + 31-point curve',hartree_fock_payload)
    if importlib.util.find_spec('pyscf'):
        from backend.optional_computation import compute
        run('Optional H2 PBE worker + HOMO mesh',lambda:compute('h2','pbe'))
        children=resource.getrusage(resource.RUSAGE_CHILDREN)
        child_rss=children.ru_maxrss/(1024**2 if sys.platform=='darwin' else 1024)
        print(f'Worker peak RSS={child_rss:.1f} MiB; child CPU={children.ru_utime+children.ru_stime:.4f}s')
    print('Peak RSS is lifetime high-water, not additive/current memory. Browser/GPU/HTTP/concurrent jobs excluded.')
