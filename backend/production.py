"""Bounded public ASGI gateway; the local advanced HTTP application is preserved."""
import asyncio
from collections import OrderedDict
import json
import logging
import mimetypes
import os
from pathlib import Path
import sys
import tempfile
import time
from urllib.parse import parse_qs
from .public_policy import PublicSettings,UNAVAILABLE,capabilities,normalize

ROOT=Path(__file__).resolve().parents[1]

class Limits:
    def __init__(self,rate,burst,max_clients=2048):self.rate=rate/60;self.burst=burst;self.clients=OrderedDict();self.max_clients=max_clients
    def allow(self,key):
        now=time.monotonic();tokens,last=self.clients.pop(key,(self.burst,now));tokens=min(self.burst,tokens+(now-last)*self.rate)
        allowed=tokens>=1
        self.clients[key]=(tokens-1 if allowed else tokens,now)
        while len(self.clients)>self.max_clients:self.clients.popitem(last=False)
        return allowed

class PublicApp:
    def __init__(self,settings=None):
        self.settings=settings or PublicSettings.from_env();self.cache=OrderedDict();self.cache_size=0;self.busy=False;self.process=None
        self.clients=Limits(self.settings.per_ip_per_minute,40);self.global_limit=Limits(self.settings.global_per_minute,60)
        self.static_clients=Limits(120,40);self.static_global=Limits(240,60)
        self.dist=ROOT/'frontend/dist'
        self.catalog_body=None
        self.elements_body=(ROOT/'quantum_engine/data/elements.json').read_bytes()

    def cache_get(self,key):
        entry=self.cache.pop(key,None)
        if not entry:return None
        expires,body=entry
        if expires<time.monotonic():self.cache_size-=len(body);return None
        self.cache[key]=entry;return body

    def cache_put(self,key,body):
        if len(body)>self.settings.max_response_bytes:return
        old=self.cache.pop(key,None)
        if old:self.cache_size-=len(old[1])
        self.cache[key]=(time.monotonic()+self.settings.cache_ttl_seconds,body);self.cache_size+=len(body)
        while len(self.cache)>32 or self.cache_size>self.settings.cache_bytes:
            _,(_,old)=self.cache.popitem(last=False);self.cache_size-=len(old)

    async def compute(self,path,query):
        process=None
        try:
            with tempfile.TemporaryDirectory(prefix='qal-public-') as scratch:
                env=dict(os.environ,QAL_COMPUTE_TIMEOUT=str(self.settings.timeout_seconds),TMPDIR=scratch,OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',MKL_NUM_THREADS='1',VECLIB_MAXIMUM_THREADS='1',PYTHONUNBUFFERED='1')
                with open(Path(scratch)/'worker.log','w+b') as errors:
                    process=await asyncio.create_subprocess_exec(sys.executable,'-m','backend.public_worker',cwd=ROOT,env=env,stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=errors)
                    self.process=process
                    process.stdin.write(json.dumps({'path':path,'query':query}).encode());await process.stdin.drain();process.stdin.close()
                    async def output():
                        chunks=[];size=0
                        while data:=await process.stdout.read(65536):
                            size+=len(data)
                            if size>self.settings.max_response_bytes:raise ValueError('Public response is too large; choose a smaller preview')
                            chunks.append(data)
                        await process.wait()
                        return b''.join(chunks)
                    async def watch_memory():
                        status=Path(f'/proc/{process.pid}/status')
                        while process.returncode is None:
                            try:
                                if not sys.platform.startswith('linux'):
                                    await asyncio.sleep(.05);continue
                                rss=next((int(line.split()[1]) for line in status.read_text().splitlines() if line.startswith('VmRSS:')),0)
                                if rss>self.settings.worker_memory_mib*1024:raise MemoryError('Public scientific worker exceeded its memory limit')
                            except (FileNotFoundError,ProcessLookupError):return
                            await asyncio.sleep(.05)
                    reader=asyncio.create_task(output());monitor=asyncio.create_task(watch_memory())
                    try:
                        done,_=await asyncio.wait({reader,monitor},timeout=self.settings.timeout_seconds,return_when=asyncio.FIRST_COMPLETED)
                        if not done:raise TimeoutError('Public scientific calculation timed out')
                        if monitor in done and monitor.exception():raise monitor.exception()
                        body=await asyncio.wait_for(reader,timeout=.2 if monitor in done else self.settings.timeout_seconds)
                        if process.returncode:raise RuntimeError('Public worker stopped within its resource limits')
                        result=json.loads(body)
                        if 'error' in result:return result.get('status',400),self.json(result)
                        return 200,self.json(result['data'])
                    finally:
                        for task in (reader,monitor):
                            if not task.done():task.cancel()
                        await asyncio.gather(reader,monitor,return_exceptions=True)
        except (TimeoutError,MemoryError,RuntimeError,ValueError,asyncio.TimeoutError) as error:
            return 503,self.json({'error':str(error)+'. Try a smaller preview or advanced local mode.'})
        finally:
            if process is not None:
                if process.returncode is None:
                    try:process.kill()
                    except ProcessLookupError:pass
                await process.wait()
            self.process=None

    @staticmethod
    def json(value):return json.dumps(value,allow_nan=False,separators=(',',':')).encode()

    async def reply(self,send,status,body,kind='application/json; charset=utf-8',cache='no-store',head=False,extra=()):
        headers=[(b'content-type',kind.encode()),(b'content-length',str(len(body)).encode()),(b'cache-control',cache.encode()),
                 (b'x-content-type-options',b'nosniff'),(b'referrer-policy',b'strict-origin-when-cross-origin'),
                 (b'content-security-policy',b"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"),
                 (b'permissions-policy',b'camera=(), microphone=(), geolocation=()'),*extra]
        await send({'type':'http.response.start','status':status,'headers':headers});await send({'type':'http.response.body','body':b'' if head else body})

    async def __call__(self,scope,receive,send):
        if scope['type']=='lifespan':
            while True:
                event=await receive()
                if event['type']=='lifespan.startup':
                    status,body=await self.compute('/api/chemistry/catalog',{})
                    if status!=200:
                        await send({'type':'lifespan.startup.failed','message':'Scientific catalog initialization failed'});return
                    self.catalog_body=body
                    await send({'type':'lifespan.startup.complete'})
                elif event['type']=='lifespan.shutdown':
                    if self.process and self.process.returncode is None:self.process.kill();await self.process.wait()
                    await send({'type':'lifespan.shutdown.complete'});return
            return
        if scope['type']!='http':return
        method=scope['method'];path=scope['path'];head=method=='HEAD'
        async def respond(status,value,**options):await self.reply(send,status,value if isinstance(value,bytes) else self.json(value),head=head,**options)
        try:
            if method not in ('GET','HEAD'):
                return await respond(503 if path.startswith('/api/jobs') else 405,{'error':UNAVAILABLE if path.startswith('/api/jobs') else 'Only GET/HEAD are supported in this public demo'},extra=[(b'allow',b'GET, HEAD')])
            if path=='/api/health':return await respond(200 if (self.dist/'index.html').is_file() else 503,{'status':'ok','mode':'public','elements':118,'version':'3.0.0a1','commit':os.getenv('RAILWAY_GIT_COMMIT_SHA','unknown'),'frontend_ready':(self.dist/'index.html').is_file()})
            if path=='/api/capabilities':return await respond(200,capabilities())
            raw=scope.get('query_string',b'')
            if len(path)>2048 or len(raw)>16384:return await respond(414,{'error':'Request URL is too long'})
            if path.startswith('/api/'):
                # Remote address is trusted by default. Never trust arbitrary X-Forwarded-For.
                # Global backstop still bounds all clients/forwarded-header spoof attempts.
                client=(scope.get('client') or ('unknown',0))[0]
                if not self.clients.allow(client) or not self.global_limit.allow('all'):return await respond(429,{'error':'Public demo rate limit reached; wait and retry'},extra=[(b'retry-after',b'5')])
                query=normalize(path,parse_qs(raw.decode('utf-8'),max_num_fields=24,keep_blank_values=True))
                if path=='/api/elements':return await respond(200,self.elements_body)
                if path=='/api/chemistry/catalog' and self.catalog_body is not None:return await respond(200,self.catalog_body)
                key=path+'?'+json.dumps(query,sort_keys=True)
                cached=self.cache_get(key)
                if cached is not None:return await respond(200,cached,extra=[(b'x-qal-cache',b'HIT')])
                if self.busy:return await respond(503,{'error':'The public scientific worker is busy. Retry shortly.'},extra=[(b'retry-after',b'1')])
                self.busy=True
                try:
                    status,body=await self.compute(path,query)
                    if status==200:self.cache_put(key,body)
                    return await respond(status,body,extra=[(b'x-qal-cache',b'MISS')])
                finally:self.busy=False
            client=(scope.get('client') or ('unknown',0))[0]
            if not self.static_clients.allow(client) or not self.static_global.allow('all'):
                return await respond(429,{'error':'Public asset rate limit reached; wait and retry'},extra=[(b'retry-after',b'5')])
            target=(self.dist/(path.lstrip('/') or 'index.html')).resolve()
            if not target.is_relative_to(self.dist.resolve()):return await respond(403,{'error':'Invalid static path'})
            if not target.is_file():return await respond(404,{'error':'Asset not found'})
            if target.stat().st_size>4*1024**2:return await respond(413,{'error':'Static asset exceeds public limit'})
            kind=mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
            cache='public, max-age=31536000, immutable' if target.parent.name=='assets' else 'no-cache'
            await respond(200,target.read_bytes(),kind=kind,cache=cache)
        except PermissionError as error:await respond(503,{'error':str(error)})
        except KeyError:await respond(404,{'error':'Unknown API endpoint'})
        except (ValueError,TypeError,OverflowError,UnicodeDecodeError,RecursionError) as error:await respond(400,{'error':str(error)})
        except Exception:
            logging.exception('Public request failed')
            await respond(500,{'error':'The public request failed. Retry a smaller calculation.'})

app=PublicApp()

def main():
    import uvicorn
    host=os.getenv('QAL_HOST','0.0.0.0');port=int(os.getenv('PORT',os.getenv('QAL_PORT','8765')))
    if not 1<=port<=65535:raise ValueError('PORT must be 1…65535')
    uvicorn.run(app,host=host,port=port,workers=1,limit_concurrency=32,backlog=32,timeout_keep_alive=5,timeout_graceful_shutdown=12,
                h11_max_incomplete_event_size=16384,proxy_headers=False,server_header=False)

if __name__=='__main__':main()
