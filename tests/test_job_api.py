import json
import threading
import time
import unittest
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from backend.server import Handler,LocalHTTPServer


class Quiet(Handler):
    def log_message(self,*args):pass


class JobApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=LocalHTTPServer(('127.0.0.1',0),Quiet)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.base=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def call(self,path,method='GET',data=None,headers=None):
        body=json.dumps(data).encode() if data is not None else None
        request=Request(self.base+path,data=body,method=method,headers={'Content-Type':'application/json',**(headers or {})})
        try:
            with urlopen(request,timeout=5) as response:return response.status,json.load(response)
        except HTTPError as error:
            with error:return error.code,json.load(error)
    def test_job_validation_and_local_origin(self):
        self.assertEqual(self.call('/api/jobs','POST',{'request':{'system':'o2','spin':1}})[0],400)
        self.assertEqual(self.call('/api/jobs','POST',{'request':{}},{'Origin':'https://unrelated.example'})[0],403)
        self.assertEqual(self.call('/api/jobs','POST',{}, {'Content-Type':'text/plain'})[0],415)
        self.assertEqual(self.call('/api/jobs/unknown')[0],404)
        self.assertEqual(self.call('/api/jobs/unknown','DELETE')[0],404)
        self.assertEqual(self.call('/api/jobs','POST',{'operation':'field','calculation_id':'expired','request':{}})[0],410)
        code,data=self.call('/api/chemistry/catalog')
        self.assertEqual(code,200);self.assertIn('o2',[s['id'] for s in data['systems']])
    def test_real_job_lifecycle(self):
        import importlib.util
        if not importlib.util.find_spec('pyscf'):self.skipTest('Optional PySCF unavailable')
        code,job=self.call('/api/jobs','POST',{'request':{'quality':'preview'}})
        self.assertEqual(code,202)
        deadline=time.monotonic()+20
        while job['status'] not in ('succeeded','failed','cancelled','timed_out'):
            self.assertLess(time.monotonic(),deadline);time.sleep(.03);_,job=self.call('/api/jobs/'+job['id'])
        self.assertEqual(job['status'],'succeeded',job.get('error'))
        self.assertAlmostEqual(job['result']['total_energy_hartree'],-1.11671432506,places=8)
        self.assertIn('resources',job['result'])

    def test_core_physics_validation_and_optional_dependency_failure(self):
        from urllib.parse import urlencode
        from unittest.mock import patch
        for operation in ('well','lindblad','atomic','circuit','bands','adaptive'):
            code,data=self.call('/api/physics?'+urlencode({'operation':operation}))
            self.assertEqual(code,200,(operation,data))
        for operation,parameters in (('well',{'states':[1,1]}),('circuit',{'qubits':99}),('bands',{'grid':9999}),('lindblad',{'relaxation':-1}),('unknown',{})):
            self.assertEqual(self.call('/api/physics?'+urlencode({'operation':operation,'parameters':json.dumps(parameters)}))[0],400)
        with patch('backend.jobs.manager.importlib.util.find_spec',return_value=None):
            code,data=self.call('/api/jobs','POST',{'request':{}})
            self.assertEqual(code,503);self.assertIn('Optional PySCF unavailable',data['error'])
            self.assertEqual(self.call('/api/physics?operation=well')[0],200)
