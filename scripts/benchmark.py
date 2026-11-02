"""Repeatable backend peak-memory/time benchmark (macOS/Linux). No server required."""
import json
import resource
import sys
import time
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.geometry import orbital_geometry


def report(label, started):
    rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS reports bytes; Linux reports KiB. This is process lifetime high-water RSS.
    mib=rss/(1024**2 if sys.platform=='darwin' else 1024)
    print(f'{label}: {time.perf_counter()-started:.3f}s; peak RSS {mib:.1f} MiB',flush=True)


def main():
    t=time.perf_counter();report('Imported engine',t)
    t=time.perf_counter();orbital_geometry(1,0,0,'real','cloud','balanced',18000,.06,False);report('Balanced 1s cloud',t)
    t=time.perf_counter();orbital_geometry(4,3,-2,'real','surface','high',45000,.06,True);report('High 4f_xyz surface and nodes',t)
    t=time.perf_counter()
    for m in range(-3,4):orbital_geometry(4,3,m,'real','surface','high',45000,.06,True)
    report('Seven high-quality 4f surfaces cached',t)
    print(orbital_geometry.cache_info())
    print('Browser, GPU, HTTP serialization, and two-job concurrency are additional.')


if __name__=='__main__':main()
