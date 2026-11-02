import importlib.util
import unittest
import numpy as np
from quantum_engine.quantum_computing import circuit
from quantum_engine.materials import bands

class CircuitTests(unittest.TestCase):
 def test_bell_entanglement_endianness_and_inverse_gates(self):
  d=circuit();np.testing.assert_allclose(d['probabilities'],[.5,0,0,.5],atol=1e-15)
  self.assertAlmostEqual(d['qubit0_purity'],.5);self.assertAlmostEqual(d['qubit0_entropy_bits'],1)
  self.assertEqual(sum(d['counts']),2000);self.assertLess(abs(d['counts'][0]-1000),100)
  np.testing.assert_array_equal(d['counts'],circuit()['counts'])
  d=circuit(qubits=3,gates=[{'gate':'X','target':0}]);self.assertEqual(d['basis_labels'][np.argmax(d['probabilities'])],'001')
  sequence=[{'gate':'H','target':0},{'gate':'RY','target':1,'angle':.7},{'gate':'CX','target':1,'control':0},{'gate':'CX','target':1,'control':0},{'gate':'RY','target':1,'angle':-.7},{'gate':'H','target':0}]
  d=circuit(gates=sequence);self.assertAlmostEqual(d['probabilities'][0],1,places=14)
 def test_rotation_independent_bloch_and_phase_gates(self):
  d=circuit(qubits=1,gates=[{'gate':'RY','target':0,'angle':np.pi/3},{'gate':'RZ','target':0,'angle':np.pi/4}])
  np.testing.assert_allclose(d['qubit0_bloch'],[np.sin(np.pi/3)*np.cos(np.pi/4),np.sin(np.pi/3)*np.sin(np.pi/4),np.cos(np.pi/3)],atol=1e-14)
  d=circuit(gates=[{'gate':'H','target':0},{'gate':'CX','target':1,'control':0},{'gate':'CZ','target':1,'control':0}]);np.testing.assert_allclose(d['state_real'],[1/np.sqrt(2),0,0,-1/np.sqrt(2)],atol=1e-14)
  d=circuit(gates=[{'gate':'X','target':0},{'gate':'SWAP','target':0,'control':1}]);self.assertAlmostEqual(d['probabilities'][2],1)
 def test_invalid_and_maximum_circuit(self):
  for q in ({'qubits':6},{'gates':[{'gate':'H','target':True}]},{'gates':[{'gate':'CX','control':0,'target':0}]},{'gates':[{'gate':'RX','target':0,'angle':float('nan')}]},{'gates':[{'gate':'exec','target':0}]},{'shots':10001}):
   with self.assertRaises(ValueError):circuit(**q)
  self.assertLess(circuit(qubits=5,gates=[{'gate':'H','target':i%5} for i in range(32)])['norm_error'],1e-12)

class TightBindingTests(unittest.TestCase):
 def test_known_dispersions_dirac_point_and_reciprocal_cells(self):
  for model in ('chain','square','honeycomb'):
   d=bands(model=model,hopping=1,onsite=.3)
   self.assertLess(d['reciprocal_identity_error'],1e-14)
   self.assertAlmostEqual(d['dos_integral_states_per_cell'],d['bands_per_cell'],places=12)
   self.assertAlmostEqual(d['mean_energy_ev'],.3,places=12)
   self.assertAlmostEqual(d['energy_variance_ev2'],{'chain':2,'square':4,'honeycomb':3}[model],places=12)
   if model=='chain':self.assertAlmostEqual(d['energies_ev'][0][0],2.3);self.assertAlmostEqual(d['energies_ev'][0][40],-1.7)
   if model=='square':self.assertAlmostEqual(d['energies_ev'][0][0],-3.7)
   if model=='honeycomb':
    np.testing.assert_allclose(d['energies_ev'][:,80],[.3,.3],atol=1e-14)
    # Independent Bloch-matrix diagonalization along the full k path.
    lattice=d['lattice_vectors_angstrom']
    for i,k in enumerate(d['path_k_per_angstrom']):
     off=-(1+np.exp(1j*k@lattice[0])+np.exp(1j*k@lattice[1]));matrix=np.array([[.3,off],[off.conjugate(),.3]])
     np.testing.assert_allclose(np.linalg.eigvalsh(matrix),d['energies_ev'][:,i],atol=1e-14)
 def test_dos_grid_convergence_and_invalid(self):
  # Convergence of the sampled absolute energy moment toward a dense BZ reference.
  ref=bands(grid=161);reference=np.sum(abs(ref['dos_energy_ev'])*ref['dos_states_per_ev_cell'])*(ref['dos_energy_ev'][1]-ref['dos_energy_ev'][0])
  coarse=bands(grid=21);fine=bands(grid=81)
  def moment(d):return np.sum(abs(d['dos_energy_ev'])*d['dos_states_per_ev_cell'])*(d['dos_energy_ev'][1]-d['dos_energy_ev'][0])
  self.assertLess(abs(moment(fine)-reference),abs(moment(coarse)-reference))
  for q in ({'model':'dft'},{'grid':10000},{'length':float('inf')},{'hopping':-1}):
   with self.assertRaises(ValueError):bands(**q)

@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF unavailable')
class MolecularVQETests(unittest.TestCase):
 def test_jordan_wigner_algebra_and_same_basis_fci(self):
  from quantum_engine.quantum_computing.vqe import annihilation,vqe
  from quantum_engine.chemistry.models import ChemistryRequest
  from quantum_engine.chemistry.correlated import correlation,CorrelationOptions
  operators=[annihilation(i) for i in range(4)]
  for i,a in enumerate(operators):
   for j,b in enumerate(operators):
    np.testing.assert_allclose(a@b+b@a,0,atol=1e-15)
    np.testing.assert_allclose(a@b.conj().T+b.conj().T@a,np.eye(16) if i==j else 0,atol=1e-15)
  for r in (1.,1.4,3.,6.):
   q=ChemistryRequest(distance=r);d,_=vqe(q);exact,_=correlation(q,CorrelationOptions(method='fci'));v=d['vqe']
   self.assertAlmostEqual(v['total_energy_hartree'],exact['correlation']['total_energy_hartree'],delta=1e-9)
   self.assertAlmostEqual(v['particle_count'],2,places=12)
   self.assertLess(v['pauli_reconstruction_error'],1e-12)
  with self.assertRaises(ValueError):vqe(ChemistryRequest(basis='6-31g'))
