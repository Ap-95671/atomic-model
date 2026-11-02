"""Transparent benchmark lookup baseline; deliberately abstains outside evidence."""
from importlib.resources import files
import json
import math


def benchmark_data()->dict:
    return json.loads(files('research_engine').joinpath('data/baseline.json').read_text())


def recommend(system='h2',basis='sto-3g',distance=1.4,spin=0,property='total_energy',tolerance_hartree=.01,budget_seconds=1.)->dict:
    """Choose lowest measured median-latency method meeting observed benchmark error.

    This is an empirical lookup baseline for exact benchmark conditions, not a
    learned router or an accuracy/latency guarantee for a new molecule/geometry.
    Evaluation-molecule records never enter recommendations.
    """
    if not isinstance(system,str) or not isinstance(basis,str) or type(spin) is not int or not 0<=spin<=4:
        raise ValueError('Valid system, basis and spin required')
    for name,value,lo,hi in (('distance',distance,.6,10),('tolerance_hartree',tolerance_hartree,1e-8,1),('budget_seconds',budget_seconds,.00001,90)):
        if type(value) not in (int,float) or not math.isfinite(value) or not lo<=value<=hi:raise ValueError(f'{name} must be finite within {lo}…{hi}')
    if property!='total_energy':raise ValueError('Baseline supports total_energy only; no unvalidated property transfer')
    data=benchmark_data()
    base={'policy':'Measured finite-basis benchmark lookup v1','selected_method':None,'abstained':True,
          'request':{'system':system,'basis':basis,'distance':distance,'spin':spin,'property':property,'tolerance_hartree':tolerance_hartree,'budget_seconds':budget_seconds},
          'assumptions':'Observed energy errors are relative to FCI in this same finite basis, not experiment or the complete-basis limit. Runtime is measured median local solver latency, not a hard runtime bound or portable performance estimate. Exact system/basis/geometry/spin matching only; evaluation molecules are excluded. No statistical uncertainty calibration, ML, research novelty, generalization or publication-readiness claim.'}
    record=next((r for r in data['cases'] if r['split']!='evaluation' and r['system']==system and r['basis']==basis and abs(r['distance']-distance)<1e-8 and r['spin']==spin),None)
    if record is None:return {**base,'reason':'No matching calibration evidence; abstaining rather than promising unvalidated accuracy.','candidates':[]}
    candidates=[{**m,'within_observed_error':m['absolute_error_hartree']<=tolerance_hartree,'within_measured_budget':m['median_wall_seconds']<=budget_seconds} for m in record['methods']]
    feasible=[m for m in candidates if m['converged'] and m['within_observed_error'] and m['within_measured_budget']]
    if not feasible:return {**base,'reason':'No measured candidate meets both requested error and measured-latency criteria.','candidates':candidates,'diagnostics':record['diagnostics']}
    selected=min(feasible,key=lambda m:m['median_wall_seconds'])
    return {**base,'selected_method':selected['method'],'abstained':False,'reason':'Lowest measured median latency among converged candidates satisfying both observed benchmark constraints.',
            'selected_evidence':selected,'candidates':candidates,'diagnostics':record['diagnostics'],'reference_energy_hartree':record['reference_energy_hartree'],'reference_method':'FCI / same finite basis'}
