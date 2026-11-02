"""Scientific invariants, independent analytic identities, and sampling checks."""
import unittest
import numpy as np
from numpy.testing import assert_allclose
from scipy.special import roots_legendre
from quantum_engine import QuantumState, wavefunction, density
from quantum_engine.angular_wavefunctions import angular
from quantum_engine.radial_wavefunctions import radial, radial_nodes, radial_probability, normalization
from quantum_engine.probability import sample_positions
from quantum_engine.energy_levels import energy_ev, transition
from quantum_engine.constants import reduced_mass_ratio
from quantum_engine.atomic_structure import species, ISOTOPES
from quantum_engine.electron_configuration import ELEMENTS, configuration_for, aufbau
from backend.geometry import orbital_geometry


class QuantumNumberTests(unittest.TestCase):
    def test_all_valid_viewer_states(self):
        for n in range(1,9):
            for l in range(min(4,n)):
                for m in range(-l,l+1):
                    for spin in [-0.5,0.5]:
                        self.assertEqual(QuantumState(n,l,m,spin).nodes['total'],n-1)

    def test_invalid_states(self):
        for args in [(0,0),(-1,0),(1,1),(2,-1),(2,1,2),(2,1,-2),(1,0,0,0),(1.2,0),(True,0),(2,1,0.5)]:
            with self.subTest(args=args),self.assertRaises(ValueError):QuantumState(*args)
        with self.assertRaises(ValueError):QuantumState(1,0,basis='invalid')


class WavefunctionTests(unittest.TestCase):
    def test_1s_closed_form_and_symmetry(self):
        xyz=np.array([[0,0,0],[1,0,0],[0,1,0],[0,0,1],[3,0,0]])
        expected=np.exp(-np.linalg.norm(xyz,axis=1))/np.sqrt(np.pi)
        assert_allclose(wavefunction(QuantumState(1,0),xyz),expected,rtol=1e-13)
        assert_allclose(density(QuantumState(1,0),xyz),np.exp(-2*np.linalg.norm(xyz,axis=1))/np.pi)

    def test_radial_normalization_all_shells_and_scaling(self):
        for n in range(1,9):
            for l in range(min(4,n)):
                with self.subTest(n=n,l=l):self.assertAlmostEqual(normalization(n,l,7,15),1,places=8)

    def test_angular_normalization_orthogonality(self):
        cos_t,weights=roots_legendre(40)
        phi=np.linspace(0,2*np.pi,80,endpoint=False)
        theta=np.arccos(cos_t)[:,None]
        for basis in ['real','complex']:
            for l in range(4):
                ys=[angular(l,m,theta,phi[None,:],basis) for m in range(-l,l+1)]
                matrix=np.array([[np.sum(np.conj(a)*b*weights[:,None])*2*np.pi/80 for b in ys] for a in ys])
                assert_allclose(matrix,np.eye(2*l+1),atol=1e-13)

    def test_2s_node_and_radial_phase(self):
        assert_allclose(radial_nodes(2,0),[2])
        self.assertAlmostEqual(float(radial(2,0,2)),0,places=13)
        self.assertGreater(float(radial(2,0,1)),0)
        self.assertLess(float(radial(2,0,3)),0)

    def test_radial_node_roots_all_shells(self):
        for n in range(1,9):
            for l in range(min(n,4)):
                roots=radial_nodes(n,l)
                self.assertEqual(len(roots),n-l-1)
                assert_allclose(radial(n,l,roots),0,atol=1e-12)

    def test_real_p_planes_and_orientation(self):
        axes=np.eye(3)
        for m,axis in [(1,0),(-1,1),(0,2)]:
            values=wavefunction(QuantumState(2,1,m),axes)
            self.assertGreater(abs(values[axis]),0.02)
            assert_allclose(np.delete(values,axis),0,atol=1e-17)
            self.assertAlmostEqual(float(wavefunction(QuantumState(2,1,m),axes[axis])), -float(wavefunction(QuantumState(2,1,m),-axes[axis])))

    def test_d_angular_polynomial_structure(self):
        # Independent Cartesian solid harmonics, compared up to normalization.
        xyz=np.array([[1,2,3],[-2,3,1],[2,-1,4],[3,2,-1]],float)
        x,y,z=xyz.T;r=np.linalg.norm(xyz,axis=1)
        forms={-2:x*y,-1:y*z,0:2*z*z-x*x-y*y,1:x*z,2:x*x-y*y}
        for m,polynomial in forms.items():
            values=angular(2,m,np.arccos(z/r),np.arctan2(y,x))*r**2
            assert_allclose(values/values[0],polynomial/polynomial[0],atol=1e-13)
        # d_z² has opposite axial and equatorial phase (torus).
        values=wavefunction(QuantumState(3,2,0),[[0,0,2],[2,0,0]])
        self.assertLess(np.prod(values),0)
        # Nodal cones cos²θ=1/3.
        self.assertAlmostEqual(float(angular(2,0,np.arccos(1/np.sqrt(3)),0)),0,places=13)

    def test_f_all_seven_angular_geometries(self):
        xyz=np.array([[1,2,3],[-2,3,1],[2,-1,4],[3,2,-1]],float)
        x,y,z=xyz.T;r=np.linalg.norm(xyz,axis=1)
        forms={-3:y*(3*x*x-y*y),-2:x*y*z,-1:y*(4*z*z-x*x-y*y),0:z*(2*z*z-3*x*x-3*y*y),
               1:x*(4*z*z-x*x-y*y),2:z*(x*x-y*y),3:x*(x*x-3*y*y)}
        for m,polynomial in forms.items():
            values=angular(3,m,np.arccos(z/r),np.arctan2(y,x))*r**3
            assert_allclose(values/values[0],polynomial/polynomial[0],atol=1e-12)
        # f_xyz: all three coordinate planes are nodes.
        assert_allclose(wavefunction(QuantumState(4,3,-2),[[0,1,1],[1,0,1],[1,1,0]]),0,atol=1e-17)

    def test_complex_and_real_basis_distinction(self):
        a=wavefunction(QuantumState(2,1,1,basis='complex'),[[1,0,0],[0,1,0]])
        assert_allclose(abs(a[0]),abs(a[1]))
        self.assertAlmostEqual(float(np.angle(a[1]/a[0])),np.pi/2)
        real=wavefunction(QuantumState(2,1,1),[[1,0,0],[0,1,0]])
        self.assertGreater(abs(real[0]),abs(real[1])*100)

    def test_nonnegative_density_and_parity(self):
        xyz=np.random.default_rng(17).normal(size=(200,3))*4
        for n,l in [(1,0),(2,0),(2,1),(3,2),(4,3),(5,3)]:
            for m in range(-l,l+1):
                state=QuantumState(n,l,m)
                self.assertTrue(np.all(density(state,xyz)>=0))
                assert_allclose(wavefunction(state,-xyz),(-1)**l*wavefunction(state,xyz),atol=1e-15)

    def test_reduced_mass_charge_scaling(self):
        self.assertLess(reduced_mass_ratio(1),1)
        for bad_mass in [0,-1,float("nan")]:
            with self.assertRaises(ValueError):reduced_mass_ratio(bad_mass)
        r=np.linspace(0,5,30)
        assert_allclose(radial(2,1,r,3),3**1.5*radial(2,1,r*3),atol=1e-13)
        self.assertAlmostEqual(float(radial_probability(1,0,0)),0)


class ProbabilityTests(unittest.TestCase):
    def test_sample_1s_mean_variance_and_isotropy(self):
        xyz=sample_positions(QuantumState(1,0),50000)
        r=np.linalg.norm(xyz,axis=1)
        self.assertAlmostEqual(float(r.mean()),1.5,delta=.015)
        self.assertAlmostEqual(float(r.var()),.75,delta=.025)
        assert_allclose(xyz.mean(axis=0),0,atol=.015)
        assert_allclose(np.mean((xyz/r[:,None])**2,axis=0),1/3,atol=.008)

    def test_p_directional_probability_and_radial_moment(self):
        xyz=sample_positions(QuantumState(2,1,1),50000)
        r=np.linalg.norm(xyz,axis=1)
        self.assertAlmostEqual(float(r.mean()),5,delta=.035)
        assert_allclose(np.mean((xyz/r[:,None])**2,axis=0),[.6,.2,.2],atol=.008)

    def test_sampling_bounds(self):
        with self.assertRaises(ValueError):sample_positions(QuantumState(1,0),60001)


class EnergyTests(unittest.TestCase):
    def test_hydrogen_and_charge_scaling(self):
        mass=species()['nuclear_mass_u']
        self.assertAlmostEqual(energy_ev(1,1,mass),-13.598287,places=5)
        self.assertAlmostEqual(energy_ev(2),energy_ev(1)/4)
        self.assertAlmostEqual(energy_ev(2,2),energy_ev(1))
        self.assertGreater(energy_ev(1,1,mass),energy_ev(1))

    def test_balmer_transition(self):
        line=transition(3,2,1,species()['nuclear_mass_u'])
        self.assertAlmostEqual(line['wavelength_nm'],656.47,delta=.03)
        self.assertEqual(line['kind'],'emission')
        self.assertEqual(transition(2,3)['kind'],'absorption')
        with self.assertRaises(ValueError):transition(2,2)
        with self.assertRaises(ValueError):energy_ev(0)


class AtomicDataTests(unittest.TestCase):
    def test_all_118_data_integrity(self):
        self.assertEqual(len(ELEMENTS),118)
        self.assertEqual(len({e['symbol'] for e in ELEMENTS}),118)
        self.assertEqual(len({(e['table_row'],e['table_column']) for e in ELEMENTS}),118)
        self.assertTrue(all(1<=e['period']<=7 for e in ELEMENTS))
        for z in range(1,119):
            a=species(z)
            self.assertEqual(a['z'],z)
            self.assertEqual(a['protons']+a['neutrons'],a['a'])
            self.assertEqual(sum(a['electronic']['configuration'].values()),z)
            for sub in a['electronic']['occupancy']:
                spins=[o['spins'] for o in sub['orbitals']]
                self.assertEqual(sum(map(len,spins)),sub['electrons'])
                for values in spins:self.assertIn(values,[[],[.5],[.5,-.5]])
                if any(len(v)==2 for v in spins):self.assertTrue(all(v for v in spins))

    def test_all_first_cations_consistent(self):
        for z in range(1,93):
            config=configuration_for(z,1)
            self.assertEqual(sum(config['configuration'].values()),z-1)

    def test_example_elements_and_exceptions(self):
        expected={1:('1s',1),2:('1s',2),6:('2p',2),8:('2p',4),11:('3s',1),24:('3d',5),29:('3d',10),26:('3d',6),60:('4f',4)}
        for z,(key,count) in expected.items():self.assertEqual(configuration_for(z)['configuration'][key],count)
        self.assertEqual(configuration_for(24)['configuration']['4s'],1)
        self.assertEqual(configuration_for(29)['configuration']['4s'],1)
        self.assertEqual(configuration_for(103)['configuration']['7p'],1)
        self.assertNotIn('6d',configuration_for(103)['configuration'])
        # NIST cation rearrangements would be missed by naive removal.
        self.assertEqual(configuration_for(23,1)['configuration']['3d'],4)
        self.assertNotIn('4s',configuration_for(28,1)['configuration'])

    def test_oxygen_hund_rule(self):
        p=next(s for s in configuration_for(8)['occupancy'] if s['subshell']=='2p')
        self.assertEqual([o['spins'] for o in p['orbitals']],[[.5,-.5],[.5],[.5]])

    def test_common_ions_and_unknown(self):
        self.assertEqual(configuration_for(26,2)['configuration']['3d'],6)
        self.assertNotIn('4s',configuration_for(26,2)['configuration'])
        self.assertEqual(configuration_for(29,2)['configuration']['3d'],9)
        self.assertEqual(configuration_for(60,3)['configuration']['4f'],3)
        self.assertIsNone(configuration_for(92,5)['configuration'])
        self.assertIsNone(configuration_for(8,-2)['configuration'])

    def test_isotopes_counts_and_mass(self):
        self.assertEqual(species(1,2)['protons'],1)
        self.assertEqual(species(1,2)['neutrons'],1)
        self.assertTrue(species(1,2)['isotope']['verified'])
        self.assertEqual(species(6,13,2)['electrons'],4)
        self.assertEqual(species(2,4,1)['electrons'],1)
        self.assertGreater(species(1,2)['nuclear_mass_u'],species(1,1)['nuclear_mass_u'])
        self.assertFalse(species(1,100)['isotope']['verified'])
        for z,records in ISOTOPES.items():
            for record in records:self.assertGreaterEqual(record['a'],int(z))

    def test_invalid_compositions(self):
        for values in [(0,None,0),(119,None,0),(2,1,0),(1,1,2),(118,None,-1),(1,1,0.5)]:
            with self.subTest(values=values),self.assertRaises(ValueError):species(*values)

    def test_aufbau_is_explicitly_separate(self):
        self.assertEqual(aufbau(24)['4s'],2)
        self.assertEqual(configuration_for(24)['configuration']['4s'],1)
        for count in range(119):self.assertEqual(sum(aufbau(count).values()),count)


class GeometryTests(unittest.TestCase):
    def test_surface_vertical_slice_and_mesh_integrity(self):
        for n,l,m in [(1,0,0),(2,0,0),(2,1,1),(3,2,0),(3,2,-2),(4,3,-2),(5,3,3)]:
            with self.subTest(n=n,l=l,m=m):
                data=orbital_geometry(n,l,m,'real','surface','preview',1000,.02,True)
                self.assertTrue(data['surfaces'])
                for surface in data['surfaces']:
                    xyz=np.array(surface['vertices']);faces=np.array(surface['faces'])
                    self.assertEqual(xyz.shape[1],3)
                    self.assertTrue(np.isfinite(xyz).all())
                    self.assertLess(faces.max(),len(xyz))
                    self.assertGreaterEqual(faces.min(),0)
                    # Evaluate extracted geometry independently against ψ.
                    values=np.abs(wavefunction(QuantumState(n,l,m),xyz))
                    ratio=np.abs(values-data['amplitude_level'])/data['amplitude_level']
                    self.assertLess(float(np.median(ratio)),.2)
                if l:self.assertIsNotNone(data['node_mesh'])

    def test_cloud_and_cache(self):
        args=(2,1,0,'real','cloud','preview',1000,.06,False)
        a=orbital_geometry(*args);b=orbital_geometry(*args)
        self.assertIs(a,b)
        self.assertEqual(len(a['points']),1000)
        self.assertEqual(len(a['phases']),1000)
        self.assertEqual(len(a['surfaces']),0)

    def test_complex_surface(self):
        a=orbital_geometry(3,2,2,'complex','surface','preview',1000,.05,False)
        self.assertEqual(len(a['surfaces']),1)
        self.assertGreater(np.ptp(a['surfaces'][0]['phases']),5)


if __name__=='__main__':unittest.main()
