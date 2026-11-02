import importlib.util
import unittest
import numpy as np
from scipy.optimize import minimize_scalar
from quantum_engine.chemistry.geometry import GeometryOptions
from quantum_engine.chemistry.models import ChemistryRequest

class GeometryInputTests(unittest.TestCase):
    def test_invalid_options(self):
        for data in ({'max_steps':True},{'max_steps':100},{'gradient_tolerance':0},{'gradient_tolerance':float('nan')},{'method':'fake'}):
            with self.subTest(data=data),self.assertRaises(ValueError):GeometryOptions.parse(data)

@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF unavailable')
class GeometryScienceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from quantum_engine.chemistry.geometry import optimize
        cls.data,cls.solution=optimize(ChemistryRequest(distance=2.),GeometryOptions(),vibrations=True)

    def test_minimum_independent_scalar_search_and_gradient_convergence(self):
        from quantum_engine.chemistry.scf import solve
        from quantum_engine.chemistry.geometry import optimize
        reference=minimize_scalar(lambda r:solve(ChemistryRequest(distance=float(r)))[0]['total_energy_hartree'],bounds=(1.1,1.6),method='bounded',options={'xatol':1e-8})
        bond=self.data['optimization']['final_bonds'][0]['length_angstrom']/.529177210544
        self.assertAlmostEqual(bond,reference.x,delta=2e-6)
        self.assertAlmostEqual(self.data['total_energy_hartree'],reference.fun,delta=1e-10)
        tighter,_=optimize(ChemistryRequest(distance=2.),GeometryOptions(gradient_tolerance=1e-6))
        self.assertLess(tighter['optimization']['gradient_max'],1e-6)
        self.assertAlmostEqual(tighter['total_energy_hartree'],reference.fun,delta=1e-10)
        self.assertGreater(self.data['optimization']['energy_lowering_hartree'],.06)
        # Basis-set prediction differs from the explicitly identified experimental r_e.
        self.assertAlmostEqual(bond*.529177210544,.71223,delta=2e-5)

    def test_analytic_hessian_independent_gradient_finite_difference_convergence(self):
        from quantum_engine.chemistry.scf import build_method
        centers=np.asarray(self.data['centers_a0'])
        hessian=np.asarray(self.data['vibrations']['hessian_hartree_per_a0_squared']).transpose(0,2,1,3).reshape(6,6)
        errors=[]
        for step in (.02,.01,.005):
            gradients=[]
            for sign in (-1,1):
                displaced=centers.copy();displaced[0,0]+=sign*step
                mol,method,_=build_method(ChemistryRequest(),displaced);method.kernel()
                gradients.append(method.nuc_grad_method().kernel().ravel())
            finite=(gradients[1]-gradients[0])/(2*step)
            errors.append(float(np.max(abs(finite-hessian[:,0]))))
        self.assertGreater(errors[0],errors[1]);self.assertGreater(errors[1],errors[2]);self.assertLess(errors[-1],3e-5)
        vib=self.data['vibrations']
        self.assertEqual(len(vib['frequencies_cm1']),1)
        self.assertAlmostEqual(vib['frequencies_cm1'][0],5480.7722,delta=.02)
        self.assertEqual(vib['imaginary_mode_count'],0)
        self.assertLess(vib['hessian_symmetry_error'],1e-9)
        mode=np.asarray(vib['modes'])[0];masses=np.asarray(vib['atomic_masses_amu'])
        self.assertLess(np.linalg.norm((masses[:,None]*mode).sum(axis=0)),1e-10)

    def test_polyatomic_three_modes_bending_and_dft_gradient(self):
        from quantum_engine.chemistry.geometry import optimize
        data,_=optimize(ChemistryRequest(system='water'),GeometryOptions(),vibrations=True)
        self.assertEqual(len(data['vibrations']['frequencies_cm1']),3)
        self.assertTrue(np.all(data['vibrations']['frequencies_cm1']>0))
        self.assertEqual(len(data['optimization']['final_angles']),1)
        self.assertLess(data['optimization']['gradient_max'],1e-5)
        for method in ('pbe','b3lyp'):
            data,_=optimize(ChemistryRequest(distance=1.5,method=method),GeometryOptions(),vibrations=True)
            self.assertGreater(data['vibrations']['frequencies_cm1'][0],3000)
            self.assertLess(data['optimization']['gradient_max'],1e-5)

    def test_failed_optimization_and_unsupported_cases_do_not_succeed(self):
        from quantum_engine.chemistry.geometry import optimize
        for request,options in ((ChemistryRequest(distance=3.),GeometryOptions(max_steps=1)),(ChemistryRequest(system='he'),GeometryOptions()),(ChemistryRequest(system='o2',spin=2),GeometryOptions()),(ChemistryRequest(system='benzene'),GeometryOptions())):
            with self.assertRaises(ValueError):optimize(request,options)

    def test_final_orbital_uses_optimized_nuclei(self):
        from quantum_engine.chemistry.scf import field
        result=field(self.solution,ChemistryRequest(quality='preview'))
        np.testing.assert_allclose(result['centers_a0'],self.data['centers_a0'])
        self.assertNotAlmostEqual(abs(result['centers_a0'][1][0]),1.)
        self.assertGreater(len(result['surfaces']),0)
