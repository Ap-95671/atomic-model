"""Actual bounded ASGI public requests; local science remains in its own suite."""
import asyncio
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlencode
from backend.public_policy import PublicSettings,normalize,capabilities
from backend.production import PublicApp,Limits

class PublicPolicyTests(unittest.TestCase):
 def test_local_capabilities_and_public_caps(self):
  self.assertTrue(capabilities(False)['advanced_computation']);self.assertFalse(capabilities()['advanced_computation'])
  for path,query in (('/api/orbital',{'quality':['high']}),('/api/orbital',{'points':['60000']}),('/api/measurement',{'count':['10001']}),('/api/tunneling',{'grid':['2048']}),('/api/tunneling',{'duration':['100'],'dt':['.005']}),('/api/physics',{'operation':['circuit'],'parameters':['{"qubits":5}']})):
   with self.subTest(path=path),self.assertRaises(ValueError):normalize(path,query)
  for path in ('/api/jobs','/api/computation/pyscf','/api/computation/hartree-fock'):
   with self.assertRaises(PermissionError):normalize(path,{})
  self.assertEqual(normalize('/api/orbital',{})['quality'],['preview'])
  with self.assertRaises(ValueError):normalize('/api/species',{'z':['1','2']})
  with self.assertRaises(KeyError):normalize('/api/arbitrary',{})
 def test_token_buckets_are_bounded_and_refill(self):
  bucket=Limits(60,2,max_clients=2)
  with patch('backend.production.time.monotonic',return_value=0):
   self.assertTrue(bucket.allow('a'));self.assertTrue(bucket.allow('a'));self.assertFalse(bucket.allow('a'))
   bucket.allow('b');bucket.allow('c');self.assertEqual(len(bucket.clients),2)
  with patch('backend.production.time.monotonic',return_value=2):self.assertTrue(bucket.allow('c'))
 def test_invalid_environment_fails_closed(self):
  for variables in ({'QAL_COMPUTE_TIMEOUT':'nan'},{'QAL_COMPUTE_TIMEOUT':'99'},{'QAL_WORKER_MEMORY_MIB':'9999'}):
   with patch.dict('os.environ',variables),self.assertRaises(ValueError):PublicSettings.from_env()

class PublicGatewayTests(unittest.IsolatedAsyncioTestCase):
 async def asyncSetUp(self):
  self.app=PublicApp();self.directory=tempfile.TemporaryDirectory();self.addCleanup(self.directory.cleanup)
  self.app.dist=Path(self.directory.name);(self.app.dist/'index.html').write_text('<title>Quantum Atom Lab</title>')
 async def request(self,path,params=None,method='GET',headers=None,app=None):
  messages=[]
  async def receive():return {'type':'http.request','body':b'','more_body':False}
  async def send(message):messages.append(message)
  scope={'type':'http','method':method,'path':path,'query_string':urlencode(params or {}).encode(),'client':('test-client',42),'headers':headers or []}
  await (app or self.app)(scope,receive,send)
  start=messages[0];body=messages[1]['body'];kind=dict(start['headers']).get(b'content-type',b'')
  data=json.loads(body) if body and b'application/json' in kind else body
  return start['status'],dict(start['headers']),data
 async def test_health_static_assets_and_readiness(self):
  status,headers,data=await self.request('/api/health');self.assertEqual(status,200);self.assertEqual(data['mode'],'public');self.assertTrue(data['frontend_ready'])
  self.assertIn(b'content-security-policy',headers)
  status,headers,body=await self.request('/');self.assertEqual(status,200);self.assertIn(b'Quantum Atom Lab',body)
  self.assertEqual((await self.request('/../../.env'))[0],403)
  self.assertEqual((await self.request('/not-a-file'))[0],404)
  self.assertEqual((await self.request('/api/capabilities'))[2]['atomic_qualities'],['preview'])
  with tempfile.TemporaryDirectory() as directory:
   self.app.dist=Path(directory);self.assertEqual((await self.request('/api/health'))[0],503)
 async def test_actual_worker_cache_and_validated_orbital(self):
  query={'quality':'preview','points':'5000','n':'2','l':'1','m':'0','mode':'surface'}
  status,headers,data=await self.request('/api/orbital',query)
  self.assertEqual(status,200,data);self.assertEqual(data['grid_size'],49);self.assertTrue(data['surfaces']);self.assertEqual(headers[b'x-qal-cache'],b'MISS')
  status,headers,cached=await self.request('/api/orbital',query);self.assertEqual(headers[b'x-qal-cache'],b'HIT');self.assertEqual(data,cached)
  self.assertIsNone(self.app.process);self.assertFalse(self.app.busy)
 async def test_all_lightweight_laboratories_and_scientific_errors(self):
  routes=[('/api/species',{'z':8}),('/api/molecular',{'quality':'preview'}),('/api/molecular/structure',{'name':'water'}),('/api/molecular/diagram',{'name':'o2'}),('/api/spectroscopy',{}),('/api/dynamics/superposition',{}),('/api/measurement',{'count':1000}),('/api/tunneling',{'duration':1}),('/api/physics',{'operation':'lindblad'}),('/api/physics',{'operation':'circuit'}),('/api/physics',{'operation':'bands'})]
  for path,params in routes:
   with self.subTest(path=path,params=params):
    status,_,data=await self.request(path,params);self.assertEqual(status,200,data)
  self.assertEqual((await self.request('/api/orbital',{'n':0}))[0],400)
  self.assertEqual((await self.request('/api/physics',{'operation':'well','parameters':'{"states":[1,1]}'}))[0],400)
 async def test_advanced_methods_unavailable_no_fabrication(self):
  for method,path in (('POST','/api/jobs'),('DELETE','/api/jobs/a'),('GET','/api/computation/pyscf'),('GET','/api/computation/hartree-fock')):
   status,_,data=await self.request(path,method=method);self.assertEqual(status,503);self.assertIn('advanced local mode',data['error'])
   self.assertNotIn('result',data)
  self.assertEqual((await self.request('/api/physics',method='POST'))[0],405)
  self.app.static_clients=Limits(120,0);self.assertEqual((await self.request('/'))[0],429)
  self.assertEqual((await self.request('/api/health'))[0],200)
 async def test_actual_timeout_reaps_worker_and_releases_slot(self):
  app=PublicApp(PublicSettings(timeout_seconds=.001))
  status,_,data=await self.request('/api/orbital',app=app)
  self.assertEqual(status,503);self.assertIn('timed out',data['error']);self.assertIsNone(app.process);self.assertFalse(app.busy)
 async def test_capacity_rate_limit_spoofed_headers_and_cache_eviction(self):
  self.app.busy=True;status,_,data=await self.request('/api/species');self.assertEqual(status,503);self.app.busy=False
  self.app.clients=Limits(60,0)
  for spoof in ('one','two'):
   self.assertEqual((await self.request('/api/elements',headers=[(b'x-forwarded-for',spoof.encode())]))[0],429)
  app=PublicApp(PublicSettings(cache_bytes=20));app.cache_put('a',b'a'*12);app.cache_put('b',b'b'*12)
  self.assertEqual(app.cache_size,12);self.assertIsNone(app.cache_get('a'));self.assertEqual(app.cache_get('b'),b'b'*12)
 async def test_head_does_not_send_body(self):
  status,headers,data=await self.request('/',method='HEAD');self.assertEqual(status,200);self.assertEqual(data,b'');self.assertGreater(int(headers[b'content-length']),0)
