import importlib.util
import unittest
import numpy as np
from quantum_engine.chemistry.models import ChemistryRequest
from quantum_engine.chemistry.correlated import CorrelationOptions,ExcitationOptions

class CorrelationInputs(unittest.TestCase):
 def test_invalid_methods_spaces_and_response(self):
  for cls,data in ((CorrelationOptions,{'method':'arbitrary'}),(CorrelationOptions,{'active_electrons':3}),(CorrelationOptions,{'active_orbitals':99}),(ExcitationOptions,{'states':True}),(ExcitationOptions,{'states':0}),(ExcitationOptions,{'method':'gap'})):
   with self.assertRaises(ValueError):cls.parse(data)

@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF unavailable')
class CorrelatedScience(unittest.TestCase):
 def test_two_electron_exact_methods_and_noncorrelating_limit(self):
  from quantum_engine.chemistry.correlated import correlation
  values={}
  for method in ('mp2','ccsd','ccsd(t)','cisd','fci','casci','casscf'):
   result,_=correlation(ChemistryRequest(),CorrelationOptions(method=method))
   values[method]=result['correlation']['total_energy_hartree']
   self.assertLess(values[method],result['total_energy_hartree'])
  for method in ('ccsd','ccsd(t)','cisd','casci','casscf'):
   self.assertAlmostEqual(values[method],values['fci'],delta=1e-8)
  self.assertAlmostEqual(values['fci'],-1.137275943617,delta=1e-10)
  # He/STO-3G has no virtuals and therefore no correlation in this basis.
  result,_=correlation(ChemistryRequest(system='he'),CorrelationOptions(method='fci'))
  self.assertAlmostEqual(result['correlation']['correlation_energy_hartree'],0,places=10)

 def test_mp2_independent_mo_integral_expression_and_basis_convergence(self):
  from quantum_engine.chemistry.correlated import correlation
  from quantum_engine.chemistry.scf import build_method
  from pyscf import ao2mo
  q=ChemistryRequest();mol,mf,_=build_method(q);mf.kernel()
  eri=ao2mo.restore(1,ao2mo.kernel(mol,mf.mo_coeff),mol.nao_nr())
  reference=eri[0,1,0,1]**2/(2*mf.mo_energy[0]-2*mf.mo_energy[1])
  result,_=correlation(q,CorrelationOptions(method='mp2'))
  self.assertAlmostEqual(result['correlation']['correlation_energy_hartree'],reference,delta=1e-12)
  expanded,_=correlation(ChemistryRequest(basis='6-31g'),CorrelationOptions(method='fci'))
  self.assertLess(expanded['correlation']['total_energy_hartree'],-1.137275943617)

 def test_response_matches_independent_matrix_eigenvalues_and_dipoles(self):
  from quantum_engine.chemistry.correlated import excitations
  from quantum_engine.chemistry.scf import build_method
  q=ChemistryRequest();mol,mf,_=build_method(q);mf.kernel()
  a,b=mf.TDHF().get_ab();a=float(a[0,0,0,0]);b=float(b[0,0,0,0])
  for name,energy in (('tda',a),('td',np.sqrt(a*a-b*b))):
   result,_=excitations(q,ExcitationOptions(method=name))
   state=result['excitations']['states'][0]
   self.assertAlmostEqual(state['excitation_hartree'],energy,delta=1e-10)
   self.assertAlmostEqual(state['oscillator_strength'],2/3*energy*np.sum(np.array(state['transition_dipole_au'])**2),delta=1e-10)
   self.assertAlmostEqual(state['xy_metric_norm'],1,places=9)
   self.assertAlmostEqual(np.sum(state['nto_weights']),1,places=9)
   self.assertAlmostEqual(state['wavelength_nm']*state['excitation_ev'],1239.84198433,delta=1e-6)
  for functional in ('pbe','b3lyp'):
   result,_=excitations(ChemistryRequest(method=functional),ExcitationOptions())
   self.assertTrue(result['excitations']['states'][0]['excitation_ev']>0)

 def test_dissociation_against_separated_fragment_limit_and_static_correlation(self):
  from quantum_engine.chemistry.correlated import bond_scan
  from pyscf import gto,scf
  result,_=bond_scan(ChemistryRequest())
  last=result['bond_scan']['points'][-1]
  atom=gto.M(atom='H 0 0 0',spin=1,basis='sto-3g',verbose=0);mf=scf.UHF(atom);mf.chkfile=None;limit=2*mf.kernel()
  self.assertAlmostEqual(last['fci'],limit,delta=3e-4)
  self.assertGreater(last['rhf']-last['fci'],.2)
  self.assertGreater(last['uhf_spin_squared'],.9)

 def test_bounded_unsupported_cases(self):
  from quantum_engine.chemistry.correlated import correlation,excitations
  for q,opts in ((ChemistryRequest(system='water',basis='6-31g'),CorrelationOptions(method='fci')),(ChemistryRequest(system='h2'),CorrelationOptions(method='casci',active_electrons=4)),(ChemistryRequest(system='o2',spin=2),CorrelationOptions()),(ChemistryRequest(method='pbe'),CorrelationOptions())):
   with self.assertRaises(ValueError):correlation(q,opts)
  with self.assertRaises(ValueError):excitations(ChemistryRequest(system='he'),ExcitationOptions())
