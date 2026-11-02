"""Cold isolated-process latency/CPU/RSS for representative 3.0 workloads."""
import argparse
from importlib.metadata import version
import json
import os
from pathlib import Path
import platform
import resource
import subprocess
import sys
import time
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
CASES={'atomic-high':None,'o2-uhf':{'operation':'scf','request':{'system':'o2','spin':2,'distance':2.5,'quality':'balanced'}},
       'water-vibrations':{'operation':'vibrations','request':{'system':'water','quality':'preview'},'options':{}},
       'water-ccsd':{'operation':'correlation','request':{'system':'water','quality':'preview'},'options':{'method':'ccsd'}},
       'water-excitations':{'operation':'excitations','request':{'system':'water','quality':'preview'},'options':{'states':3}},
       'h2-vqe':{'operation':'vqe','request':{'system':'h2','quality':'preview'}}}
CORE=('general-well','atomic-evolution','lindblad','circuits','honeycomb')


def core(case):
    from importlib import import_module
    from quantum_atom_lab import HydrogenicOrbital,well_superposition,atomic_superposition,open_system,simulate_circuit,tight_binding
    modules={'atomic-high':'quantum_engine.geometry','general-well':'quantum_engine.dynamics.general','atomic-evolution':'quantum_engine.dynamics.atomic','lindblad':'quantum_engine.dynamics.open_systems','circuits':'quantum_engine.quantum_computing','honeycomb':'quantum_engine.materials'}
    import_module(modules[case])
    before=resource.getrusage(resource.RUSAGE_SELF);start=time.perf_counter()
    if case=='atomic-high':
        data=HydrogenicOrbital(4,3,2).geometry(mode='surface',quality='high',show_nodes=True)
    else:
        data={'general-well':well_superposition,'atomic-evolution':atomic_superposition,'lindblad':open_system,'circuits':simulate_circuit,'honeycomb':tight_binding}[case]()
    after=resource.getrusage(resource.RUSAGE_SELF)
    print(json.dumps({'wall_seconds':time.perf_counter()-start,'cpu_seconds':after.ru_utime+after.ru_stime-before.ru_utime-before.ru_stime,
                      'peak_rss_mib':after.ru_maxrss/(1024**2 if sys.platform=='darwin' else 1024)},allow_nan=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--case',choices=(*CASES,*CORE));parser.add_argument('--output',type=Path,default=ROOT/'docs/benchmark3.json');args=parser.parse_args()
    if args.case:core(args.case);sys.exit()
    records=[];environment=dict(os.environ,OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1',VECLIB_MAXIMUM_THREADS='1')
    for case in (*CASES,*CORE):
        payload=CASES.get(case);start=time.perf_counter()
        command=[sys.executable,'-m','backend.jobs.worker'] if payload else [sys.executable,str(Path(__file__).resolve()),'--case',case]
        process=subprocess.run(command,input=json.dumps(payload) if payload else None,text=True,capture_output=True,cwd=ROOT,env=environment,timeout=95)
        elapsed=time.perf_counter()-start
        if process.returncode:
            records.append({'case':case,'status':'failed','cold_process_wall_seconds':elapsed,'error':process.stdout[-2000:]+process.stderr[-1000:]});continue
        lines=[json.loads(line) for line in process.stdout.splitlines() if line.startswith('{')]
        final=next((event['result']['resources'] for event in lines if event.get('event')=='result'),lines[-1])
        records.append({'case':case,'status':'succeeded','cold_process_wall_seconds':elapsed,**final})
    data={'environment':{'python':platform.python_version(),'platform':platform.platform(),'numpy':version('numpy'),'scipy':version('scipy'),'pyscf':version('pyscf')},
          'measurement':'One cold isolated process per case; solver/field time vs full process/import/serialization latency are separate. Peak RSS is per process high-water mark, not total concurrent/GPU memory. Single-thread native-library environment.',
          'records':records}
    args.output.write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data,indent=2))
