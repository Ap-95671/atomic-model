"""Regress display-only requests reusing an unchanged converged SCF state."""
import importlib.util
import unittest
from unittest.mock import patch
from backend.molecular_geometry import _hartree_fock_solution, hartree_fock_payload
from backend.optional_computation import worker

class ViewReuseTests(unittest.TestCase):
 def test_foundation_solve_is_shared_across_display_fields(self):
  _hartree_fock_solution.cache_clear();hartree_fock_payload.cache_clear()
  from quantum_engine.hartree_fock import solve
  with patch('quantum_engine.hartree_fock.solve',wraps=solve) as solver:
   a=hartree_fock_payload('h2',1.6,'sto-3g','homo')
   first_calls=solver.call_count
   b=hartree_fock_payload('h2',1.6,'sto-3g','lumo')
   self.assertEqual(solver.call_count,first_calls)
   self.assertEqual(a['total_energy_hartree'],b['total_energy_hartree'])
   hartree_fock_payload('h2',1.8,'sto-3g','homo')
   self.assertEqual(solver.call_count,first_calls+1)

 @unittest.skipUnless(importlib.util.find_spec('pyscf'),'optional PySCF unavailable')
 def test_optional_field_reuse_never_runs_scf_and_preserves_numbers(self):
  from pyscf.scf.hf import RHF
  first=worker('h2','hf','sto-3g','homo')
  with patch.object(RHF,'kernel',side_effect=AssertionError('Display change must not repeat SCF')):
   second=worker('h2','hf','sto-3g','lumo',first['_solution'])
  self.assertTrue(second['scf_reused'])
  self.assertEqual(first['total_energy_hartree'],second['total_energy_hartree'])
  self.assertEqual(first['electron_count'],second['electron_count'])
  self.assertNotEqual(first['surfaces'][0]['vertices'].shape,second['surfaces'][0]['vertices'].shape)

 @unittest.skipUnless(importlib.util.find_spec('pyscf'),'optional PySCF unavailable')
 def test_serialized_larger_basis_state_survives_worker_protocol(self):
  from backend.optional_computation import compute
  compute.cache_clear()
  a=compute('water','hf','6-31g','homo')
  b=compute('water','hf','6-31g','lumo')
  self.assertTrue(b['scf_reused'])
  self.assertEqual(a['total_energy_hartree'],b['total_energy_hartree'])
  self.assertAlmostEqual(b['electron_count'],10,places=7)
  self.assertGreater(len(b['surfaces']),0)
