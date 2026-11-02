import importlib.util
import subprocess
import unittest
from unittest.mock import patch
import numpy as np
from quantum_engine.molecular.structures import structure,CATALOG
from quantum_engine.molecular.diagrams import diagram,COUNTS
from backend.optional_computation import compute


class ReferenceMoleculeTests(unittest.TestCase):
    def test_source_coordinates_connectivity_and_angles(self):
        for name in CATALOG:
            d=structure(name);p=d['coordinates_angstrom']
            self.assertEqual(len(p),len(d['atomic_numbers']))
            self.assertTrue(np.all(np.isfinite(p)))
            self.assertTrue(d['source_url'].endswith(str(d['pubchem_cid'])))
            for bond in d['bonds']:
                self.assertAlmostEqual(bond['length_angstrom'],np.linalg.norm(p[bond['a']]-p[bond['b']]),places=12)
                self.assertGreater(bond['length_angstrom'],.5)
            for angle in d['angles']:self.assertTrue(0<angle['degrees']<=180)
        self.assertAlmostEqual(structure('carbon-dioxide')['angles'][0]['degrees'],180,delta=.05)
        self.assertEqual(len(structure('benzene')['atomic_numbers']),12)
        self.assertAlmostEqual(structure('water')['angles'][0]['degrees'],103.97994,places=4)  # source conformer, not measured 104.5°
        with self.assertRaises(ValueError):structure('../outside')

    def test_occupations_bond_order_and_ordering(self):
        expected={'h2plus':(.5,1),'h2':(1,0),'he2':(0,0),'li2':(1,0),'b2':(1,2),'c2':(2,0),'n2':(3,0),'o2':(2,2),'f2':(1,0),'ne2':(0,0)}
        for name,count in COUNTS.items():
            d=diagram(name);self.assertEqual(sum(row['electrons'] for row in d['levels_low_to_high']),count)
            self.assertEqual((d['bond_order'],d['unpaired_electrons']),expected[name])
            for level in d['levels_low_to_high']:
                for spins in level['orbitals']:self.assertLessEqual(len(spins),2)
        n=[r['label'] for r in diagram('n2')['levels_low_to_high']]
        o=[r['label'] for r in diagram('o2')['levels_low_to_high']]
        self.assertLess(n.index('π2p'),n.index('σ2p'));self.assertGreater(o.index('π2p'),o.index('σ2p'))
        self.assertEqual(diagram('o2')['levels_low_to_high'][-2]['orbitals'],[[.5],[.5]])
        with self.assertRaises(ValueError):diagram('unsupported')


class OptionalBackendControlTests(unittest.TestCase):
    def test_unavailable_backend_and_timeout(self):
        compute.cache_clear()
        with patch('backend.optional_computation.importlib.util.find_spec',return_value=None):
            with self.assertRaisesRegex(RuntimeError,'not installed'):compute()
        with patch('backend.optional_computation.importlib.util.find_spec',return_value=True),patch('backend.optional_computation.subprocess.run',side_effect=subprocess.TimeoutExpired('worker',12)):
            with self.assertRaisesRegex(RuntimeError,'terminated'):compute()
        for args in [('o2','pbe','sto-3g','density'),('h2','arbitrary-code','sto-3g','density'),('h2','pbe','unknown','density')]:
            with self.assertRaises(ValueError):compute(*args)


@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF not installed')
class OptionalScientificTests(unittest.TestCase):
    def test_all_bundled_closed_shell_molecules(self):
        for name in CATALOG:
            d=compute(name,'pbe')
            self.assertAlmostEqual(d['electron_count'],sum(structure(name)['atomic_numbers']),places=7)
            self.assertTrue(d['converged']);self.assertTrue(d['surfaces'])
        large=compute('benzene','b3lyp','6-31g')
        self.assertTrue(large['converged']);self.assertEqual(large['basis_size'],66)

    def test_hf_reference_and_pbe_grid_convergence(self):
        from pyscf import gto,dft
        hf=compute('h2','hf');self.assertAlmostEqual(hf['total_energy_hartree'],-1.11671432506,places=8)
        pbe=compute('h2','pbe');self.assertAlmostEqual(pbe['electron_count'],2,places=9)
        self.assertTrue(pbe['converged']);self.assertTrue(pbe['surfaces'])
        self.assertEqual(sum(pbe['occupations']),2)
        mol=gto.M(atom='H -.7 0 0; H .7 0 0',unit='Bohr',basis='sto-3g',verbose=0)
        ref=dft.RKS(mol);ref.xc='pbe';ref.grids.level=3;ref.chkfile=None;ref.conv_tol=1e-10
        self.assertAlmostEqual(pbe['total_energy_hartree'],ref.kernel(),delta=2e-5)
        for method in ('pbe','b3lyp'):
            d=compute('water',method);self.assertAlmostEqual(d['electron_count'],10,places=8)
            self.assertEqual(d['geometry']['pubchem_cid'],962)
            self.assertTrue(np.all(np.isfinite(d['orbital_energies_hartree'])))
        expanded=compute('h2','pbe','6-31g')
        self.assertGreater(expanded['basis_size'],pbe['basis_size'])
        self.assertLess(expanded['total_energy_hartree'],pbe['total_energy_hartree'])
