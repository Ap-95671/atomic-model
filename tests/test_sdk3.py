import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import numpy as np
from quantum_atom_lab import HydrogenicOrbital,well_superposition,atomic_superposition,open_system,simulate_circuit,tight_binding,molecular_calculation
from research_engine import recommend,benchmark_data

ROOT=Path(__file__).resolve().parents[1]

class PublicSDKTests(unittest.TestCase):
 def test_broadcast_density_wavefunction_geometry_and_validation(self):
  orbital=HydrogenicOrbital(1,0)
  self.assertAlmostEqual(float(orbital.probability_density(0,0,0)),1/np.pi,places=14)
  xyz=np.array([0.,1.,2.]);np.testing.assert_allclose(orbital.probability_density(0,0,xyz),np.exp(-2*xyz)/np.pi,atol=1e-14)
  self.assertAlmostEqual(orbital.validate()['radial_probability_integral'],1,places=11)
  data=HydrogenicOrbital(2,1).geometry(mode='surface',quality='preview');self.assertTrue(data['surfaces'])
  for args in ((0,0),(2,2),(2,1,2)):
   with self.assertRaises(ValueError):HydrogenicOrbital(*args)
 def test_core_wrappers_and_optional_import_isolation(self):
  self.assertLess(well_superposition()['max_norm_error'],1e-12)
  self.assertLess(atomic_superposition(points=1000)['max_norm_error'],1e-12)
  self.assertLess(open_system()['max_trace_error'],1e-12)
  self.assertAlmostEqual(simulate_circuit()['qubit0_entropy_bits'],1)
  self.assertAlmostEqual(tight_binding()['dos_integral_states_per_cell'],2)
  script='''import sys
class DenyPySCF:
 def find_spec(self,fullname,path=None,target=None):
  if fullname.split('.')[0] in ('pyscf','qutip','backend'):raise ImportError('optional/backend import blocked')
sys.meta_path.insert(0,DenyPySCF())
import quantum_atom_lab as q
assert q.HydrogenicOrbital(1,0).probability_density(0,0,0)>0
q.HydrogenicOrbital(1,0).geometry(quality='preview')
q.atomic_superposition(points=1000)
q.open_system()
q.simulate_circuit()
q.tight_binding()
from research_engine import recommend
assert not recommend()['abstained']
assert 'pyscf' not in sys.modules
'''
  subprocess.run([sys.executable,'-c',script],cwd=ROOT,check=True,capture_output=True)
 def test_packaged_data_matches_provenance_tracked_canonical_snapshot(self):
  for file in (ROOT/'quantum_engine/data').rglob('*'):
   if file.is_file():self.assertEqual(file.read_bytes(),(ROOT/'data'/file.relative_to(ROOT/'quantum_engine/data')).read_bytes())
 def test_invalid_molecular_operation(self):
  with self.assertRaises(ValueError):molecular_calculation({},'arbitrary')

class AdaptiveBaselineTests(unittest.TestCase):
 def test_measured_pareto_constraints_and_abstention(self):
  result=recommend(tolerance_hartree=.01)
  self.assertFalse(result['abstained'])
  feasible=[m for m in result['candidates'] if m['within_observed_error'] and m['within_measured_budget']]
  self.assertEqual(result['selected_method'],min(feasible,key=lambda m:m['median_wall_seconds'])['method'])
  self.assertLessEqual(result['selected_evidence']['absolute_error_hartree'],.01)
  self.assertTrue(recommend(system='water')['abstained'])
  self.assertTrue(recommend(distance=1.5)['abstained'])
  self.assertTrue(recommend(spin=2)['abstained'])
  self.assertTrue(recommend(budget_seconds=.00001)['abstained'])
 def test_molecule_disjoint_splits_reference_methods_and_fixed_baselines(self):
  data=benchmark_data();sets={}
  for record in data['cases']:
   sets.setdefault(record['split'],set()).add(record['system'])
   for m in record['methods']:
    self.assertAlmostEqual(m['absolute_error_hartree'],abs(m['energy_hartree']-record['reference_energy_hartree']),places=13)
  self.assertFalse(sets['training']&sets['evaluation']);self.assertFalse(sets['calibration']&sets['evaluation'])
  for record in data['cases']:
   if record['split']=='evaluation':self.assertTrue(recommend(system=record['system'],basis=record['basis'],distance=record['distance'])['abstained'])
 def test_invalid_policy_inputs(self):
  for args in ({'tolerance_hartree':float('nan')},{'budget_seconds':-1},{'property':'dipole'},{'spin':True}):
   with self.assertRaises(ValueError):recommend(**args)
