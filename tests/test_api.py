"""HTTP contract and validation, using an ephemeral loopback server."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from urllib.error import HTTPError
from backend.server import Handler, LocalHTTPServer


class QuietHandler(Handler):
    def log_message(self,*args):pass


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=LocalHTTPServer(('127.0.0.1',0),QuietHandler)
        cls.worker=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.worker.start()
        cls.base=f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.worker.join()

    def get(self,path):
        try:
            with urlopen(self.base+path,timeout=15) as r:return r.status,json.load(r)
        except HTTPError as e:
            with e:return e.code,json.load(e)

    def test_bounded_http_handlers(self):
        for _ in range(self.server.max_handlers):self.server.handler_slots.acquire()
        try:self.assertEqual(self.get('/api/health')[0],503)
        finally:
            for _ in range(self.server.max_handlers):self.server.handler_slots.release()
        self.assertEqual(self.get('/api/health')[0],200)

    def test_health_and_periodic_table(self):
        self.assertEqual(self.get('/api/health')[1]['elements'],118)
        self.assertEqual(len(self.get('/api/elements')[1]),118)

    def test_isotope_and_ion(self):
        code,atom=self.get('/api/species?z=2&a=3&charge=1')
        self.assertEqual(code,200)
        self.assertEqual((atom['protons'],atom['neutrons'],atom['electrons']),(2,1,1))
        self.assertTrue(atom['one_electron'])

    def test_orbital_cloud(self):
        code,data=self.get('/api/orbital?n=2&l=1&m=1&points=1000&nodes=true')
        self.assertEqual(code,200)
        self.assertEqual(len(data['points']),1000)
        self.assertIsNotNone(data['node_mesh'])
        self.assertAlmostEqual(data['normalization'],1,places=8)

    def test_many_electron_energy_protection(self):
        code,data=self.get('/api/orbital?z=6&n=3&l=2&m=0&points=1000')
        self.assertEqual(code,200)
        self.assertIsNone(data['energy_ev'])
        self.assertEqual(self.get('/api/energy?z=6')[0],400)

    def test_hydrogenic_transition(self):
        code,data=self.get('/api/energy?z=2&charge=1&initial=3&final=2')
        self.assertEqual(code,200)
        self.assertEqual(len(data['levels']),8)
        self.assertAlmostEqual(data['wavelength_nm'],164.1,delta=.1)

    def test_reject_invalid_input_and_limits(self):
        for path in ['/api/species?z=0','/api/species?z=2&a=1','/api/species?z=1&charge=2',
            '/api/orbital?n=1&l=1','/api/orbital?n=9','/api/orbital?points=60001',
            '/api/orbital?zeff=nan&z=6','/api/orbital?quality=unbounded',
            '/api/orbital?basis=bad','/api/orbital?spin=0','/api/energy?initial=2&final=2']:
            with self.subTest(path=path):self.assertEqual(self.get(path)[0],400)

    def test_spectroscopy_and_measurement_contracts(self):
        code,data=self.get('/api/spectroscopy?i_n=3&i_l=1&f_n=2&f_l=0')
        self.assertEqual(code,200)
        self.assertTrue(data['transition']['allowed'])
        self.assertAlmostEqual(data['transition']['wavelength_nm'],656.47,delta=.02)
        self.assertEqual(data['series']['name'],'Balmer')
        code,data=self.get('/api/measurement?n=2&l=1&m=0&count=1000&seed=123')
        self.assertEqual(code,200)
        self.assertEqual(sum(data['counts'])+data['tail_count'],1000)
        self.assertEqual(len(data['edges_a0']),61)
        self.assertIn('uncertainty_product',data['units'])
        self.assertEqual(self.get('/api/spectroscopy/transition?i_n=2&i_l=0&f_n=1&f_l=0')[1]['dipole_squared_a0'],0)
        self.assertEqual(self.get('/api/spectroscopy/series?lower=3')[1]['name'],'Paschen')

    def test_fields_structures_and_reference_diagrams(self):
        code,d=self.get('/api/fields?magnetic=0&electric=.000001')
        self.assertEqual(code,200)
        self.assertTrue(all(v==0 for v in d['lande_shifts_ev']))
        self.assertAlmostEqual(d['stark_shifts_ev'][1],3e-6*27.21138624598,places=10)
        self.assertEqual(self.get('/api/molecular/diagram?name=o2')[1]['unpaired_electrons'],2)
        self.assertEqual(self.get('/api/molecular/structure?name=water')[1]['pubchem_cid'],962)
        for path in ['/api/fields?z=2','/api/fields?magnetic=3','/api/fields?electric=nan',
                     '/api/fields?l=0&j=1.5','/api/molecular/structure?name=../outside',
                     '/api/molecular/diagram?name=unknown','/api/computation/pyscf?method=invalid']:
            with self.subTest(path=path):self.assertEqual(self.get(path)[0],400)

    def test_optional_backend_failure_is_explicit(self):
        from unittest.mock import patch
        with patch('backend.server.optional_compute',side_effect=RuntimeError('Optional backend unavailable')):
            code,d=self.get('/api/computation/pyscf')
            self.assertEqual(code,503);self.assertIn('unavailable',d['error'])

    def test_hartree_fock_contract(self):
        code,data=self.get('/api/computation/hartree-fock?system=he')
        self.assertEqual(code,200);self.assertTrue(data['converged'])
        self.assertAlmostEqual(data['electron_count'],2)
        self.assertAlmostEqual(data['total_energy_hartree'],-2.8077839566,places=8)
        self.assertEqual(len(data['density_matrix']),1)
        for path in ['/api/computation/hartree-fock?system=o2','/api/computation/hartree-fock?basis=unknown',
                     '/api/computation/hartree-fock?distance=nan','/api/computation/hartree-fock?system=he&view=lumo']:
            with self.subTest(path=path):self.assertEqual(self.get(path)[0],400)

    def test_molecular_contract_and_validation(self):
        code,data=self.get('/api/molecular?distance=2&orbital=antibonding')
        self.assertEqual(code,200)
        self.assertEqual(len(data['surfaces']),2)
        self.assertAlmostEqual(data['overlap'],.586452894,places=8)
        self.assertLess(data['residual'],1e-12)
        self.assertIn('nuclear_repulsion_hartree',data)
        for path in ['/api/molecular?distance=0','/api/molecular?distance=nan',
                     '/api/molecular?orbital=unsupported','/api/molecular?threshold=0']:
            with self.subTest(path=path):self.assertEqual(self.get(path)[0],400)

    def test_dynamics_contract_and_bounds(self):
        code,data=self.get('/api/dynamics/superposition')
        self.assertEqual(code,200)
        self.assertAlmostEqual(data['normalization'],1,places=10)
        self.assertEqual(data['units']['energy'],'Hartree')
        code,data=self.get('/api/tunneling?duration=1')
        self.assertEqual(code,200)
        self.assertLess(data['max_norm_error'],1e-10)
        self.assertEqual(len(data['x_a0']),512)
        for path in ['/api/tunneling?grid=99999','/api/tunneling?dt=nan',
                     '/api/tunneling?duration=100&dt=.005','/api/dynamics/superposition?ar=0&br=0',
                     '/api/dynamics/superposition?state_a=2','/api/dynamics/superposition?state_a=9']:
            with self.subTest(path=path):self.assertEqual(self.get(path)[0],400)

    def test_experiment_validation_and_capacity(self):
        for path in ['/api/measurement?n=9','/api/measurement?l=1&n=1',
                     '/api/measurement?seed=-1','/api/measurement?count=60001',
                     '/api/measurement?z=2','/api/measurement?basis=invalid',
                     '/api/spectroscopy?i_n=2&f_n=2','/api/spectroscopy?i_n=9',
                     '/api/spectroscopy/series?lower=4','/api/spectroscopy?polarization=invalid',
                     '/api/spectroscopy?z=6','/api/spectroscopy?i_spin=nan']:
            with self.subTest(path=path): self.assertEqual(self.get(path)[0],400)
        from backend.server import COMPUTE
        COMPUTE.acquire();COMPUTE.acquire()
        try: self.assertEqual(self.get('/api/measurement')[0],503)
        finally: COMPUTE.release();COMPUTE.release()

    def test_unknown_endpoint_and_directory_traversal(self):
        self.assertEqual(self.get('/api/unknown')[0],404)
        self.assertEqual(self.get('/%2e%2e/%2e%2e/requirements.txt')[0],403)


if __name__=='__main__':unittest.main()
