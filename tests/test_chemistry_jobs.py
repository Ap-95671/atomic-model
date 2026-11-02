"""Spin-aware molecule workflow: numerical invariants, references and real cancellation."""
import importlib.util
import threading
import time
import unittest
from unittest.mock import patch
import numpy as np
from quantum_engine.chemistry import ChemistryRequest
from quantum_engine.molecular import lcao, amplitude
from backend.jobs import JobManager


class ChemistryInputTests(unittest.TestCase):
    def test_rejects_unsupported_and_nonfinite_requests(self):
        invalid = [{'system':'../../outside'}, {'method':'exec'}, {'distance':float('nan')},
                   {'spin':True}, {'system':'o2','spin':1}, {'system':'o2','spin':2,'method':'rhf'},
                   {'basis':'arbitrary'}, {'grid_level':20}, {'quality':'unbounded'}, {'extra':1},
                   {'diis':'true'}, {'guess':'broken-symmetry'}, {'orbital':160}]
        for data in invalid:
            with self.subTest(data=data), self.assertRaises(ValueError): ChemistryRequest.parse(data)

    def test_optimized_surface_grid_convergence(self):
        from backend.molecular_geometry import molecule_payload
        errors=[molecule_payload(2,'bonding',.12,1.,True,q)['max_relative_surface_residual']
                for q in ('preview','balanced','high')]
        self.assertGreater(errors[0],errors[1]);self.assertGreater(errors[1],errors[2])
        self.assertLess(errors[2],.004)

    def test_optimized_slater_basis_is_variational_and_normalized(self):
        fixed=lcao(2); optimized=lcao(2,optimize=True)
        self.assertLess(optimized['total_energies_hartree'][0],fixed['total_energies_hartree'][0])
        self.assertAlmostEqual(optimized['basis_exponent'],1.238698,delta=2e-6)
        self.assertAlmostEqual(optimized['total_energies_hartree'][0],-.58650599,delta=2e-8)
        np.testing.assert_allclose(optimized['orthonormality'],np.eye(2),atol=1e-13)
        zeta=optimized['basis_exponent'];step=1e-4
        derivative=(lcao(2,zeta+step)['total_energies_hartree'][0]-lcao(2,zeta-step)['total_energies_hartree'][0])/(2*step)
        self.assertLess(abs(derivative),2e-7)
        from scipy.integrate import simpson
        x=np.linspace(-12,12,801);rho=np.linspace(0,12,601)
        xx,rr=np.meshgrid(x,rho,indexing='ij');points=np.stack([xx,rr,np.zeros_like(xx)],axis=-1)
        for name in ('bonding','antibonding'):
            psi=amplitude(points,2,name,optimized['basis_exponent'])
            norm=simpson(simpson(abs(psi)**2*2*np.pi*rr,x=rho,axis=1),x=x)
            self.assertAlmostEqual(norm,1,delta=2e-6)
        # Independently integrate the kinetic quadratic form and Coulomb
        # potentials in cylindrical coordinates, rather than reusing H/S.
        radii=np.stack([np.sqrt((xx+1)**2+rr**2),np.sqrt((xx-1)**2+rr**2)],axis=-1)
        ao=zeta**1.5*np.exp(-zeta*radii)/np.sqrt(np.pi)
        coefficients=optimized['coefficients'][:,0]
        dx=-zeta*np.sum(ao*coefficients*np.stack([xx+1,xx-1],axis=-1)/radii,axis=-1)
        dr=-zeta*rr*np.sum(ao*coefficients/radii,axis=-1)
        psi=np.sum(ao*coefficients,axis=-1)
        density_energy=.5*(dx**2+dr**2)-np.sum(1/radii,axis=-1)*psi**2
        electronic=simpson(simpson(density_energy*2*np.pi*rr,x=rho,axis=1),x=x)
        self.assertAlmostEqual(electronic+.5,optimized['total_energies_hartree'][0],delta=3e-4)


@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF not installed')
class SpinAwareScienceTests(unittest.TestCase):
    def test_triplet_oxygen_counts_spin_and_independent_energy(self):
        from quantum_engine.chemistry.scf import solve
        from pyscf import gto,scf
        request=ChemistryRequest.parse({'system':'o2','spin':2,'distance':2.5})
        data,_=solve(request)
        self.assertAlmostEqual(data['spin_electron_counts'][0],9,places=8)
        self.assertAlmostEqual(data['spin_electron_counts'][1],7,places=8)
        self.assertAlmostEqual(data['spin_squared_target'],2)
        self.assertLess(abs(data['spin_contamination']),.02)
        mol=gto.M(atom='O -1.25 0 0; O 1.25 0 0',unit='Bohr',basis='sto-3g',spin=2,verbose=0)
        reference=scf.UHF(mol);reference.chkfile=None;reference.conv_tol=1e-11
        self.assertAlmostEqual(data['total_energy_hartree'],reference.kernel(),delta=1e-8)
        self.assertLess(data['energy_decomposition_error'],1e-7)
        self.assertLess(data['orthonormality_error'],1e-10)

    def test_all_requested_diatomics_and_basis_sensitivity(self):
        from quantum_engine.chemistry.models import DIATOMICS
        from quantum_engine.chemistry.scf import solve
        for system,(_,_,_,spin) in DIATOMICS.items():
            request=ChemistryRequest.parse({'system':system,'spin':spin,'distance':2.5})
            data,_=solve(request)
            self.assertTrue(data['converged'])
            self.assertAlmostEqual(data['electron_count'],sum(data['spin_electron_counts']),places=9)
            self.assertLess(data['energy_decomposition_error'],1e-6)
        minimal,_=solve(ChemistryRequest())
        expanded,_=solve(ChemistryRequest(basis='cc-pvdz'))
        self.assertGreater(expanded['basis_size'],minimal['basis_size'])
        self.assertLess(expanded['total_energy_hartree'],minimal['total_energy_hartree'])

    def test_uks_grids_rohf_broken_symmetry_and_nonconvergence(self):
        from quantum_engine.chemistry.scf import solve
        for request in (ChemistryRequest(system='o2',spin=2,method='pbe',distance=2.5),
                        ChemistryRequest(system='o2',spin=2,method='rohf',distance=2.5)):
            data,_=solve(request)
            self.assertAlmostEqual(data['electron_count'],16,places=8)
            self.assertLess(data['energy_decomposition_error'],1e-6)
        rhf,_=solve(ChemistryRequest(distance=6))
        uhf,_=solve(ChemistryRequest(distance=6,method='uhf',guess='broken-symmetry'))
        self.assertLess(uhf['total_energy_hartree'],rhf['total_energy_hartree']-.1)
        self.assertGreater(uhf['spin_contamination'],.1)
        with self.assertRaisesRegex(ValueError,'did not converge'):
            solve(ChemistryRequest(system='water',max_cycles=1))


@unittest.skipUnless(importlib.util.find_spec('pyscf'),'Optional PySCF not installed')
class JobTests(unittest.TestCase):
    def setUp(self):self.manager=JobManager(threading.BoundedSemaphore(2),timeout=30)
    def tearDown(self):self.manager.close()
    def finish(self,job):
        limit=time.monotonic()+35
        while job['status'] not in ('succeeded','failed','cancelled','timed_out'):
            if time.monotonic()>limit:self.fail('Job did not terminate')
            time.sleep(.02);job=self.manager.get(job['id'])
        return job

    def test_progress_every_orbital_and_field_reuses_scf(self):
        job=self.finish(self.manager.submit({'request':{'system':'n2','distance':2.5,'quality':'preview'}}))
        self.assertEqual(job['status'],'succeeded',job.get('error'))
        self.assertTrue(any('iteration' in p for p in job['progress']))
        self.assertAlmostEqual(job['result']['electron_count'],14,places=8)
        result=self.finish(self.manager.submit({'operation':'field','calculation_id':job['id'],
                            'request':{'orbital':0,'channel':'beta','view':'orbital','quality':'preview'}}))
        self.assertEqual(result['status'],'succeeded',result.get('error'))
        self.assertEqual(result['result']['field']['orbital_index'],0)
        self.assertFalse(any('iteration' in p for p in result['progress']))
        self.assertTrue(result['result']['field']['surfaces'])
        for surface in result['result']['field']['surfaces']:
            self.assertLess(np.max(surface['faces']),len(surface['vertices']))

    def test_cancel_reaps_actual_process_and_releases_capacity(self):
        job=self.manager.submit({'request':{'system':'benzene','basis':'cc-pvdz','method':'b3lyp','grid_level':3,'quality':'high'}})
        limit=time.monotonic()+5
        while self.manager.records[job['id']]['process'] is None:
            if time.monotonic()>limit:self.fail('Worker never started')
            time.sleep(.01)
        process=self.manager.records[job['id']]['process']
        self.manager.cancel(job['id']);done=self.finish(job)
        self.assertEqual(done['status'],'cancelled')
        self.assertIsNotNone(process.poll())
        self.assertIsNone(self.manager.records[job['id']]['process'])
        with self.assertRaises(KeyError):self.manager.get('not-a-job')

    def test_timeout_and_failed_job_are_not_successes(self):
        self.manager.timeout=.001
        done=self.finish(self.manager.submit({'request':{}}))
        self.assertEqual(done['status'],'timed_out')
        self.manager.timeout=30
        failed=self.finish(self.manager.submit({'request':{'system':'water','max_cycles':1}}))
        self.assertEqual(failed['status'],'failed')
        self.assertIn('converge',failed['error'])
        self.assertNotIn('result',failed)
