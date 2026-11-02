"""Independent formula, quadrature and statistical validation of new laboratories."""
import unittest
import numpy as np
from scipy.constants import h, c, e
from quantum_engine import QuantumState
from quantum_engine.atomic_structure import species
from quantum_engine.spectroscopy import electric_dipole, spectral_series, radial_dipole
from quantum_engine.measurement import measurement


def qs(n, l=0, m=0, spin=.5): return QuantumState(n,l,m,spin,"complex")


class SpectroscopyTests(unittest.TestCase):
    def test_lyman_alpha_reference_and_units(self):
        # NIST vacuum fine-structure components: 121.566824, 121.567364 nm.
        # Our unresolved nonrelativistic model is within 0.003 nm, not identical.
        d=electric_dipole(qs(2,1),qs(1),1,species(1,1)["nuclear_mass_u"])
        self.assertAlmostEqual(d['wavelength_nm'],121.567364,delta=.003)
        self.assertAlmostEqual(abs(d['delta_ev'])*e,h*d['frequency_hz'],delta=1e-32)
        self.assertAlmostEqual(d['wavelength_nm']*1e-9*d['frequency_hz'],c,delta=1e-6)
        self.assertIn('vacuum',d['units']['wavelength'])

    def test_closed_form_1s_2p_dipole(self):
        # Exact infinite-mass radial integral 256/(81√6); angular |z| factor 1/√3.
        self.assertAlmostEqual(radial_dipole(1,0,2,1),256/(81*np.sqrt(6)),places=10)
        d=electric_dipole(qs(1),qs(2,1))
        self.assertAlmostEqual(d['dipole_squared_a0'],(128*np.sqrt(2)/243)**2,places=10)
        # Sum over all final m gives the analytic 1s -> 2p oscillator strength.
        strength=sum(electric_dipole(qs(1),qs(2,1,m))['dipole_squared_a0'] for m in (-1,0,1))
        self.assertAlmostEqual(2/3*(3/8)*strength,.41619671798,places=9)

    def test_selection_spin_and_polarization(self):
        self.assertFalse(electric_dipole(qs(1),qs(2))['allowed'])
        self.assertFalse(electric_dipole(qs(1),qs(2,1,0,-.5))['allowed'])
        self.assertTrue(electric_dipole(qs(1),qs(2,1,1),polarization='sigma+')['allowed'])
        self.assertEqual(electric_dipole(qs(1),qs(2,1,1),polarization='pi')['dipole_squared_a0'],0)
        self.assertFalse(electric_dipole(qs(3,2,-2),qs(2,1,1))['allowed'])

    def test_reverse_and_charge_scaling(self):
        a=electric_dipole(qs(1),qs(2,1)); b=electric_dipole(qs(2,1),qs(1))
        self.assertEqual(a['kind'],'absorption');self.assertEqual(b['kind'],'emission')
        self.assertAlmostEqual(a['dipole_squared_a0'],b['dipole_squared_a0'],places=12)
        charged=electric_dipole(qs(1),qs(2,1),z=2)
        self.assertAlmostEqual(charged['wavelength_nm'],a['wavelength_nm']/4)
        self.assertAlmostEqual(charged['dipole_squared_a0'],a['dipole_squared_a0']/4)

    def test_series_limits_and_validation(self):
        for lower in (1,2,3):
            d=spectral_series(lower)
            self.assertTrue(all(a['wavelength_nm']>b['wavelength_nm'] for a,b in zip(d['lines'],d['lines'][1:])))
            self.assertLess(d['limit_nm'],d['lines'][-1]['wavelength_nm'])
        for args in [(qs(2),qs(2,1)), (qs(9),qs(2,1))]:
            with self.assertRaises(ValueError): electric_dipole(*args)
        with self.assertRaises(ValueError): spectral_series(4)
        with self.assertRaises(ValueError): electric_dipole(qs(1),qs(2,1),polarization='invalid')


class MeasurementTests(unittest.TestCase):
    def test_ground_state_moments_and_uncertainty(self):
        d=measurement(QuantumState(1,0),60000,123)
        self.assertAlmostEqual(d['mean_r_a0'],1.5)
        np.testing.assert_allclose(d['sigma_position_xyz_a0'],1,atol=1e-12)
        np.testing.assert_allclose(d['sigma_momentum_xyz_au'],1/np.sqrt(3),atol=1e-12)
        np.testing.assert_allclose(d['uncertainty_products_xyz_hbar'],1/np.sqrt(3),atol=1e-12)
        self.assertAlmostEqual(d['sample_mean_r_a0'],1.5,delta=.015)
        self.assertEqual(sum(d['counts'])+d['tail_count'],60000)
        self.assertAlmostEqual(sum(d['theory_bin_probability'])+d['theory_tail_probability'],1)

    def test_histogram_goodness_of_fit(self):
        d=measurement(QuantumState(2,1,0),60000,91)
        expected=d['theory_bin_probability']*60000
        keep=expected>10
        chi2=np.sum((d['counts'][keep]-expected[keep])**2/expected[keep])
        self.assertLess(chi2,110)  # generous fixed-seed threshold for <=60 bins
        self.assertAlmostEqual(d['sigma_position_xyz_a0'][2]**2,18,places=10)
        self.assertTrue(all(d['uncertainty_products_xyz_hbar']>=.5-1e-12))

    def test_seed_reproduction_charge_and_bounds(self):
        a=measurement(qs(3,2,1),1000,5);b=measurement(qs(3,2,1),1000,5,z=2)
        np.testing.assert_array_equal(a['counts'],b['counts'])
        np.testing.assert_allclose(a['uncertainty_products_xyz_hbar'],b['uncertainty_products_xyz_hbar'])
        self.assertAlmostEqual(a['mean_r_a0']/2,b['mean_r_a0'])
        for kwargs in ({'seed':-1},{'count':60001},{'count':0},{'seed':2**32}):
            with self.assertRaises(ValueError): measurement(qs(1),**kwargs)
        with self.assertRaises(ValueError): measurement(qs(9))
