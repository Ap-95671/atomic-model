import unittest
import numpy as np
from scipy.integrate import simpson
from quantum_engine.dynamics import superposition, evaluate_superposition
from quantum_engine.dynamics.tunneling import propagate, barrier_transmission


class SuperpositionTests(unittest.TestCase):
    def test_eigenstate_density_stationary_and_normalized(self):
        d=superposition(state_a=3,br=0,ai=2)
        initial=evaluate_superposition(d,0)
        for t in (0,1,10,47):
            psi=evaluate_superposition(d,t)
            np.testing.assert_allclose(abs(psi)**2,abs(initial)**2,atol=1e-14)
            self.assertAlmostEqual(simpson(abs(psi)**2,x=d['x_a0']),1,places=12)

    def test_interference_expectation_and_complex_coefficients(self):
        d=superposition(ar=1,ai=2,br=-.5,bi=1.2)
        for i in (0,30,100,160,200):
            psi=evaluate_superposition(d,d['times_au'][i])
            integral=simpson(d['x_a0']*abs(psi)**2,x=d['x_a0'])
            self.assertAlmostEqual(integral,d['expectation_x_a0'][i],places=7)
        self.assertGreater(np.ptp(d['expectation_x_a0']),.1)
        # For same-parity states density evolves, but the position mean stays L/2.
        even=superposition(state_b=3)
        np.testing.assert_allclose(even['expectation_x_a0'],5)
        self.assertGreater(np.max(abs(abs(evaluate_superposition(even,0))**2-abs(evaluate_superposition(even,even['period_au']/2))**2)),.01)

    def test_period_revival_and_hard_walls(self):
        d=superposition()
        np.testing.assert_allclose(abs(evaluate_superposition(d,0))**2,abs(evaluate_superposition(d,d['period_au']))**2,atol=1e-14)
        self.assertAlmostEqual(d['energies_hartree'][0],np.pi**2/200)
        self.assertAlmostEqual(d['normalization'],1,places=12)
        self.assertLess(np.max(abs(np.array(d['basis'])[:,[0,-1]])),1e-14)
        for kwargs in ({'ar':0,'br':0},{'ar':float('nan')},{'state_a':9},{'state_a':2},{'length':0}):
            with self.assertRaises(ValueError):superposition(**kwargs)


class TunnelingTests(unittest.TestCase):
    def test_analytic_barrier_limits(self):
        self.assertEqual(barrier_transmission(1,0,2),1)
        self.assertEqual(barrier_transmission(1,2,0),1)
        self.assertEqual(barrier_transmission(0,2,1),0)
        self.assertAlmostEqual(barrier_transmission(.8,.8,2),1/(1+.8*4/2))
        self.assertAlmostEqual(barrier_transmission(1+np.pi**2/8,1,2),1)
        self.assertLess(barrier_transmission(.2,1,3),barrier_transmission(.2,1,1))

    def test_probability_partition_and_stationary_reference(self):
        d=propagate()
        self.assertLess(d['max_norm_error'],1e-10)
        self.assertLess(d['max_boundary_probability'],1e-6)
        for f in d['frames']:
            self.assertAlmostEqual(f['left_probability']+f['right_probability']+f['barrier_probability'],f['norm'],places=12)
        self.assertAlmostEqual(d['frames'][-1]['right_probability'],d['bandwidth_averaged_reference_transmission'],delta=.012)
        self.assertFalse(d['warnings'])

    def test_free_gaussian_motion_and_spread(self):
        d=propagate(height=0,duration=30)
        f=d['frames'][-1]
        self.assertAlmostEqual(f['mean_x_a0'],-35+1.2*30,places=8)
        p=np.array(f['real'])**2+np.array(f['imag'])**2
        var=np.sum((d['x_a0']-f['mean_x_a0'])**2*p)*(200/512)
        self.assertAlmostEqual(var,25+30**2/(4*25),places=7)

    def test_time_step_convergence(self):
        ref=propagate(dt=.01,duration=50)['frames'][-1]['right_probability']
        coarse=propagate(dt=.08,duration=50)['frames'][-1]['right_probability']
        fine=propagate(dt=.04,duration=50)['frames'][-1]['right_probability']
        self.assertLess(abs(fine-ref),abs(coarse-ref))
        self.assertLess(abs(fine-ref),.002)

    def test_grid_convergence_and_boundary_warning(self):
        a=propagate(grid=1024);b=propagate(grid=2048)
        self.assertAlmostEqual(a['effective_barrier_width_a0'],b['effective_barrier_width_a0'])
        self.assertLess(abs(a['frames'][-1]['right_probability']-b['frames'][-1]['right_probability']),.006)
        warned=propagate(momentum=3,duration=60)
        self.assertTrue(any('boundary' in w for w in warned['warnings']))
        early=propagate(duration=1)
        self.assertTrue(any('not fully separated' in w for w in early['warnings']))

    def test_computation_bounds(self):
        for kwargs in ({'dt':float('nan')},{'width':0},{'height':-1},{'grid':4096},
                       {'spread':8,'center':-15},{'duration':100,'dt':.005}):
            with self.assertRaises(ValueError):propagate(**kwargs)
