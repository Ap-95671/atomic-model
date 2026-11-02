import unittest
import numpy as np
from scipy.integrate import simpson,solve_ivp
from quantum_engine.dynamics.general import well
from quantum_engine.dynamics.atomic import atomic
from quantum_engine.dynamics.open_systems import lindblad

class GeneralWellTests(unittest.TestCase):
 def test_many_state_norm_expectations_and_revival(self):
  d=well(real=[1,.2,-.3,.7],imag=[.2,.3,.4,.5]);co=np.array([complex(v['real'],v['imag']) for v in d['coefficients']]);basis=np.asarray(d['basis'])
  for i in (0,31,75,255,512):
   psi=(co*np.exp(-1j*np.asarray(d['energies_hartree'])*d['times_au'][i]))@basis
   self.assertAlmostEqual(simpson(abs(psi)**2,x=d['x_a0']),1,places=12)
   self.assertAlmostEqual(simpson(abs(psi)**2*d['x_a0'],x=d['x_a0']),d['expectation_x_a0'][i],delta=2e-7)
  np.testing.assert_allclose(abs(co@basis)**2,abs((co*np.exp(-1j*np.asarray(d['energies_hartree'])*d['revival_au']))@basis)**2,atol=1e-13)
 def test_position_quadrature_convergence_and_eigenstate(self):
  errors=[well(grid=g)['position_quadrature_error_a0'] for g in (129,257,513)]
  self.assertGreater(errors[0],errors[1]);self.assertGreater(errors[1],errors[2]);self.assertLess(errors[-1],1e-8)
  d=well(states=[5],real=[0],imag=[2]);np.testing.assert_allclose(d['expectation_x_a0'],5,atol=1e-13)
 def test_invalid_states_and_coefficients(self):
  for q in ({'states':[1,1]},{'states':[True]},{'real':[0,0,0,0],'imag':[0,0,0,0]},{'grid':100000},{'real':[1]}):
   with self.assertRaises(ValueError):well(**q)

class AtomicEvolutionTests(unittest.TestCase):
 def test_norm_quadrature_convergence_and_independent_dipole(self):
  a=atomic(quality='preview',points=1000);b=atomic(quality='balanced',points=1000)
  self.assertGreater(a['max_norm_error'],b['max_norm_error']);self.assertLess(b['max_norm_error'],1e-12)
  # Analytic <1s|z|2p0>=256/(243sqrt(2)); equal coefficients give that t=0 expectation.
  self.assertAlmostEqual(b['expectation_xyz_a0'][0,2],256/(243*np.sqrt(2)),places=11)
  self.assertAlmostEqual(b['expectation_xyz_a0'][100,2],-256/(243*np.sqrt(2)),places=11)
 def test_stationary_degenerate_density_and_weight_bounds(self):
  d=atomic(states=[[2,0,0],[2,1,1]],real=[1,0],imag=[0,1],points=1000)
  basis=np.asarray(d['basis_real'])+1j*np.asarray(d['basis_imag']);coeff=np.array([complex(v['real'],v['imag']) for v in d['coefficients']])
  initial=abs(coeff@basis)**2
  for t in (0,3,17):
   density=abs((coeff*np.exp(-1j*np.asarray(d['energies_hartree'])*t))@basis)**2
   np.testing.assert_allclose(density,initial,atol=1e-15)
   self.assertLessEqual(float(np.max(density/(len(coeff)*d['proposal_density']))),1+1e-12)
  # A complex magnetic state must have real Cartesian mean and Hermitian matrices.
  re,im=np.asarray(d['position_matrices_real_a0']),np.asarray(d['position_matrices_imag_a0']);matrix=re+1j*im
  np.testing.assert_allclose(matrix,matrix.transpose(0,2,1).conj(),atol=1e-12)
 def test_invalid_atomic_requests(self):
  for q in ({'states':[[3,0,0]]},{'states':[[1,0,0],[1,0,0]]},{'points':60001},{'real':[0,0],'imag':[0,0]},{'seed':-1}):
   with self.assertRaises(ValueError):atomic(**q)

class LindbladTests(unittest.TestCase):
 def test_analytic_relaxation_and_dephasing(self):
  d=lindblad(omega=0,drive=0,theta=90,relaxation=.4,dephasing=.3)
  for f in d['frames']:
   self.assertAlmostEqual(f['populations'][1],.5*np.exp(-.4*f['time']),places=12)
   self.assertAlmostEqual(f['coherence_real'],.5*np.exp(-(.4/2+.3)*f['time']),places=12)
  self.assertLess(d['max_trace_error'],1e-12);self.assertGreater(d['minimum_eigenvalue'],-1e-12)
 def test_unitary_mixed_limits_and_independent_ode_convergence(self):
  d=lindblad(relaxation=0,dephasing=0)
  self.assertLess(max(abs(f['purity']-1) for f in d['frames']),1e-12)
  mixed=lindblad(relaxation=0,dephasing=0,bloch_radius=0)
  np.testing.assert_allclose([f['purity'] for f in mixed['frames']],.5,atol=1e-13)
  np.testing.assert_allclose([f['entropy_bits'] for f in mixed['frames']],1,atol=1e-13)
  # Independent Bloch ODE for omega=1, drive=.5, gamma1=.2, gamma_phi=.1.
  result=lindblad();exact=result['frames'][-1]['bloch'];errors=[]
  for tolerance in (1e-3,1e-6,1e-9):
   def rhs(t,r):
    x,y,z=r;return [-y-.2*x,x-.5*z-.2*y,.5*y+.2*(1-z)]
   ode=solve_ivp(rhs,(0,10),[1,0,0],rtol=tolerance,atol=tolerance/100)
   errors.append(np.linalg.norm(ode.y[:,-1]-exact))
  self.assertGreater(errors[0],errors[1]);self.assertGreater(errors[1],errors[2]);self.assertLess(errors[-1],1e-8)
 def test_density_invariants_for_mixed_driven_and_invalid(self):
  for q in ({'theta':180},{'bloch_radius':.3,'phi':71,'drive':2},{'dephasing':2,'relaxation':0}):
   d=lindblad(**q)
   for f in d['frames']:
    density=np.array(f['density_real'])+1j*np.array(f['density_imag']);self.assertAlmostEqual(np.trace(density),1,places=11);self.assertGreater(np.linalg.eigvalsh(density).min(),-1e-11)
  for q in ({'relaxation':-1},{'duration':10000},{'samples':True},{'drive':float('nan')}):
   with self.assertRaises(ValueError):lindblad(**q)
