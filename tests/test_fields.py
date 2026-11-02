import unittest
import numpy as np
from scipy.constants import alpha,physical_constants
from quantum_engine.fields import field_experiment,HARTREE_EV,MU_B_EV


class FieldTests(unittest.TestCase):
    def test_zero_field_and_angular_momentum(self):
        d=field_experiment(0,0)
        np.testing.assert_array_equal(d['lande_shifts_ev'],0)
        np.testing.assert_array_equal(d['stark_shifts_ev'],0)
        self.assertAlmostEqual(d['lande_g'],4/3)
        self.assertAlmostEqual(field_experiment(l=1,j=.5)['lande_g'],2/3)
        self.assertAlmostEqual(field_experiment(l=0,j=.5)['lande_g'],2)
        self.assertEqual(d['spin_S_squared_hbar2'],.75)
        self.assertEqual(d['total_J_squared_hbar2'],3.75)

    def test_stark_degenerate_eigenproblem_and_mixing(self):
        d=field_experiment(electric_au=1e-6)
        c=d['mixing_coefficients_2s_2pz'];h=d['stark_matrix_hartree']
        np.testing.assert_allclose(c.T@c,np.eye(2),atol=1e-15)
        np.testing.assert_allclose(h@c,c@np.diag(d['stark_shifts_ev']/HARTREE_EV),atol=1e-20)
        np.testing.assert_allclose(d['stark_shifts_ev'],np.array([-3,3])*1e-6*HARTREE_EV)
        self.assertGreater(np.max(abs(d['mixed_density_z_axis_a0_minus3'][0]-d['mixed_density_z_axis_a0_minus3'][0][::-1])),1e-4)
        reversed_field=field_experiment(electric_au=-1e-6)
        np.testing.assert_allclose(d['mixed_density_z_axis_a0_minus3'][0],reversed_field['mixed_density_z_axis_a0_minus3'][0][::-1],atol=1e-15)

    def test_zeeman_and_fine_structure_benchmark(self):
        d=field_experiment(magnetic_tesla=.01)
        np.testing.assert_allclose(d['orbital_only_shifts_ev'],np.array([-1,0,1])*MU_B_EV*.01)
        self.assertAlmostEqual(d['fine_splitting_ev'],4.5283e-5,delta=1e-8)
        # Leading alpha^4 term for E(2p3/2)-E(2p1/2) = mc² alpha^4/32.
        mass_ev=physical_constants['electron mass energy equivalent in MeV'][0]*1e6
        self.assertAlmostEqual(d['fine_splitting_ev'],mass_ev*alpha**4/32,delta=1e-8)
        self.assertIn('weak-field',d['magnetic_note'])

    def test_invalid_coupling_and_fields(self):
        for kwargs in ({'l':2},{'l':0,'j':1.5},{'j':0},{'magnetic_tesla':3},{'electric_au':float('nan')},{'electric_au':1e-3}):
            with self.assertRaises(ValueError):field_experiment(**kwargs)
