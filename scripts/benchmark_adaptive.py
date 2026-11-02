"""Reproduce a small, molecule-disjoint benchmark; no external licensed dataset."""
import argparse
from importlib.metadata import version
import json
from pathlib import Path
import platform
import statistics
import sys
import time
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from quantum_engine.chemistry.models import ChemistryRequest
from quantum_engine.chemistry.scf import solve
from quantum_engine.chemistry.correlated import correlation,CorrelationOptions


def run(repeats):
    cases=[]
    for name,system,basis,distance,split in [('h2-equilibrium','h2','sto-3g',1.4,'training'),('h2-stretched','h2','sto-3g',3.,'training'),('h2-dissociation','h2','sto-3g',6.,'training'),('he-expanded','he','6-31g',1.4,'calibration'),('lih-held-out','lih','sto-3g',3.,'evaluation'),('water-held-out','water','sto-3g',1.4,'evaluation')]:
        q=ChemistryRequest(system=system,basis=basis,distance=distance)
        reference,_=correlation(q,CorrelationOptions(method='fci'));reference_energy=reference['correlation']['total_energy_hartree']
        methods=[]
        for method in ('hf','mp2','ccsd'):
            timings=[];cpu=[]
            for _ in range(repeats):
                start=time.perf_counter();before=time.process_time()
                result=solve(q)[0] if method=='hf' else correlation(q,CorrelationOptions(method=method))[0]
                energy=result['total_energy_hartree'] if method=='hf' else result['correlation']['total_energy_hartree']
                cpu.append(time.process_time()-before);timings.append(time.perf_counter()-start)
            methods.append({'method':method,'energy_hartree':energy,'absolute_error_hartree':abs(energy-reference_energy),'median_wall_seconds':statistics.median(timings),
                            'median_cpu_seconds':statistics.median(cpu),'wall_repetitions_seconds':timings,'converged':True})
        gap=reference['channels'][0]['gap_hartree']
        cases.append({'id':name,'system':system,'basis':basis,'distance':distance,'spin':0,'split':split,'reference_energy_hartree':reference_energy,'methods':methods,
                      'diagnostics':{'electron_count':reference['electron_count'],'basis_size':reference['basis_size'],'hf_gap_hartree':gap,'spin_squared':reference['spin_squared'],
                                     'note':'Closing RHF gaps and stretching can signal static correlation; no single diagnostic guarantees accuracy.'}})
    # A fixed tolerance provides reproducible strong-baseline/ablation tables,
    # not a held-out trained-model score. No evaluation records route decisions.
    tolerance=.01
    fixed={m:{'successes':sum(next(v for v in case['methods'] if v['method']==m)['absolute_error_hartree']<=tolerance for case in cases),'cases':len(cases)} for m in ('hf','mp2','ccsd')}
    cheapest=sum(min(case['methods'],key=lambda v:v['median_wall_seconds'])['absolute_error_hartree']<=tolerance for case in cases)
    return {'schema_version':1,'provenance':'Generated from local PySCF; FCI references in the identical finite basis/source geometry, no external training dataset.',
            'environment':{'python':platform.python_version(),'platform':platform.platform(),'pyscf':version('pyscf'),'numpy':version('numpy'),'scipy':version('scipy')},
            'repeats':repeats,'cases':cases,'evaluation':{'tolerance_hartree':tolerance,'fixed_method_baselines':fixed,'latency_only_ablation_successes':cheapest,
                                                       'heldout_policy':'Abstention on LiH/water; no generalization claim. All H2 geometries stay in one molecule split.',
                                                       'selection_regret':'Not estimated on unseen molecules: lookup abstains. Within-domain reference-aware choice is a lookup oracle, not a learned predictor.',
                                                       'uncertainty_calibration':'Not performed; no probabilistic error bars returned.'}}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repeats',type=int,default=3);parser.add_argument('--output',type=Path,default=ROOT/'research_engine/data/baseline.json');args=parser.parse_args()
    if not 1<=args.repeats<=10:parser.error('repeats must be 1…10')
    data=run(args.repeats);args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(data,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'output':str(args.output),'cases':len(data['cases']),'evaluation':data['evaluation']},indent=2))
