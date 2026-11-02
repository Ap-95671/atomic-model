import unittest
import numpy as np
from scipy.integrate import simpson
from quantum_engine.molecular import lcao,amplitude,bond_curve
from backend.molecular_geometry import molecule_payload


class MolecularTests(unittest.TestCase):
    def test_generalized_eigenproblem_and_analytic_normalization(self):
        for r in (.5,1,2,5,10):
            d=lcao(r);s=d['overlap_matrix'];h=d['hamiltonian_hartree'];c=d['coefficients'];e=d['electronic_energies_hartree']
            np.testing.assert_allclose(c.T@s@c,np.eye(2),atol=1e-13)
            np.testing.assert_allclose(h@c,s@c@np.diag(e),atol=1e-13)
            self.assertAlmostEqual(d['overlap'],np.exp(-r)*(1+r+r*r/3),places=14)
            self.assertLess(e[0],e[1]);self.assertAlmostEqual(d['total_energies_hartree'][0]-e[0],1/r)

    def test_independent_cylindrical_overlap_and_mo_norm(self):
        # Integrate in x (bond axis) and cylindrical radius, including 2πρ dρ dx.
        x=np.linspace(-14,14,801);rho=np.linspace(0,14,501)
        xx,rr=np.meshgrid(x,rho,indexing='ij');p=np.stack([xx,rr,np.zeros_like(xx)],axis=-1)
        a=amplitude(p,2,'atomic-a');b=amplitude(p,2,'atomic-b')
        integral=lambda f:simpson(simpson(f*2*np.pi*rr,x=rho,axis=1),x=x)
        self.assertAlmostEqual(integral(a*b),lcao(2)['overlap'],delta=2e-6)
        self.assertAlmostEqual(integral(amplitude(p,2,'bonding')**2),1,delta=2e-6)
        self.assertAlmostEqual(integral(amplitude(p,2,'antibonding')**2),1,delta=2e-6)

    def test_antisymmetric_node_and_surface_residuals(self):
        np.testing.assert_allclose(amplitude(np.array([[0,0,0],[0,1,0],[0,0,2]]),2,'antibonding'),0,atol=1e-15)
        self.assertGreater(float(amplitude(np.array([0,0,0]),2,'bonding')),0)
        for orbital in ('bonding','antibonding'):
            d=molecule_payload(2,orbital,.12)
            self.assertEqual(len(d['surfaces']),1 if orbital=='bonding' else 2)
            for mesh in d['surfaces']:
                values=abs(amplitude(mesh['vertices'],2,orbital))
                self.assertLess(np.std(values)/np.mean(values),.04)
                self.assertLess(mesh['faces'].max(),len(mesh['vertices']))

    def test_energy_curve_minimum_and_dissociation(self):
        d=bond_curve()
        # Fixed exponent 1s basis, not the exact BO minimum (~2 a0, -0.6026 Eh).
        self.assertAlmostEqual(d['equilibrium_a0'],2.49283,delta=1e-4)
        self.assertAlmostEqual(d['minimum_total_hartree'],-.56483099237,places=10)
        self.assertGreater(d['binding_energy_hartree'],0)
        self.assertAlmostEqual(lcao(10)['total_energies_hartree'][0],-.5,delta=.002)
        self.assertGreater(lcao(.5)['total_energies_hartree'][0],d['minimum_total_hartree'])

    def test_input_limits_and_cache(self):
        for r in (0,.1,11,float('nan')):
            with self.assertRaises(ValueError):lcao(r)
        with self.assertRaises(ValueError):molecule_payload(2,'fake')
        with self.assertRaises(ValueError):molecule_payload(2,'bonding',float('nan'))
        self.assertIs(molecule_payload(2),molecule_payload(2))
