"""HTTP contract and validation, using an ephemeral loopback server."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import urlopen
from urllib.error import HTTPError
from backend.server import Handler


class QuietHandler(Handler):
    def log_message(self,*args):pass


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
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

    def test_unknown_endpoint_and_directory_traversal(self):
        self.assertEqual(self.get('/api/unknown')[0],404)
        self.assertEqual(self.get('/%2e%2e/%2e%2e/requirements.txt')[0],403)


if __name__=='__main__':unittest.main()
