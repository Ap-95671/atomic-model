import importlib.util
import unittest
import numpy as np
from scipy.integrate import simpson
from quantum_engine.hartree_fock import solve,integrals,evaluate,boys0


class HartreeFockTests(unittest.TestCase):
    def test_reference_energies_and_scf_invariants(self):
        for system,reference in [('he',-2.8077839566),('h2',-1.1167143252)]:
            d=solve(system);p=d['density_matrix'];s=d['overlap_matrix'];c=d['coefficients']
            self.assertAlmostEqual(d['total_energy_hartree'],reference,places=9)
            self.assertAlmostEqual(np.trace(p@s),2,places=10)
            np.testing.assert_allclose(p@s@p,2*p,atol=1e-8)
            np.testing.assert_allclose(c.T@s@c,np.eye(len(s)),atol=1e-10)
            self.assertLess(d['residual'],1e-10)
            self.assertTrue(d['converged'])
            self.assertLess(d['scf_history'][-1]['density_change'],1e-8)

    def test_expanded_basis_variational_energy_and_density(self):
        for system in ('he','h2'):
            contracted=solve(system);expanded=solve(system,basis='uncontracted-sto-3g')
            self.assertEqual(expanded['basis_size'],3*contracted['basis_size'])
            self.assertLess(expanded['total_energy_hartree'],contracted['total_energy_hartree'])
            x=np.linspace(-8,8,121);points=np.stack(np.meshgrid(x,x,x,indexing='ij'),axis=-1)
            density=evaluate(expanded,points)
            self.assertGreaterEqual(density.min(),0)
            self.assertAlmostEqual(simpson(simpson(simpson(density,x=x,axis=2),x=x,axis=1),x=x),2,delta=3e-5)

    def test_integral_permutations_and_boys_limit(self):
        _,s,h,eri,_,_=integrals()
        np.testing.assert_allclose(s,s.T,atol=1e-14);np.testing.assert_allclose(h,h.T,atol=1e-14)
        np.testing.assert_allclose(eri,eri.transpose(1,0,2,3),atol=1e-14)
        np.testing.assert_allclose(eri,eri.transpose(2,3,0,1),atol=1e-14)
        self.assertEqual(boys0(0),1)
        self.assertAlmostEqual(boys0(1e-8),1-1e-8/3,places=15)

    def test_nonconvergence_and_unsupported_cases(self):
        for kwargs in ({'max_iterations':1},{'system':'o2'},{'basis':'invented'},{'distance':0}):
            with self.assertRaises(ValueError):solve(**kwargs)
        with self.assertRaises(ValueError):evaluate(solve('he'),np.array([[0,0,0]]),'lumo')

    @unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF not installed')
    def test_independent_pyscf_comparison(self):
        from pyscf import gto,scf,lib
        lib.num_threads(1)
        for system,atoms in [('he','He 0 0 0'),('h2','H -.7 0 0; H .7 0 0')]:
            mol=gto.M(atom=atoms,basis='sto-3g',unit='Bohr',verbose=0)
            ref=scf.RHF(mol);ref.chkfile=None;ref.conv_tol=1e-12;energy=ref.kernel()
            self.assertTrue(ref.converged)
            d=solve(system)
            self.assertAlmostEqual(d['total_energy_hartree'],energy,delta=1e-8)  # published BSE/PySCF basis rounding
            # AO normalization conventions are independently supplied by PySCF.
            np.testing.assert_allclose(d['overlap_matrix'],mol.intor('int1e_ovlp'),atol=2e-9)
            np.testing.assert_allclose(d['electron_repulsion_integrals_hartree'],mol.intor('int2e'),atol=5e-9)
