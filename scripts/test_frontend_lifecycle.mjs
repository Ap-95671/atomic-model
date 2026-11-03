import assert from 'node:assert/strict';
import {build} from '../frontend/node_modules/esbuild/lib/main.js';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const scratch=await mkdtemp(join(tmpdir(),'qal-lifecycle-'));
try{
 const out=join(scratch,'jobs.mjs');await build({entryPoints:[process.env.QAL_JOB_SOURCE??'frontend/src/services/jobs.ts'],outfile:out,bundle:true,platform:'node',format:'esm'});const {JobClient}=await import(pathToFileURL(out));
 const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
 const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
 const deleteStarted=pending(),finishDelete=pending(),started=pending();let posts=0;
 globalThis.fetch=async(url,init)=>{if(init?.method==='POST'){posts++;return response({id:'owned-job',status:'running'});}if(init?.method==='DELETE'){deleteStarted.resolve();await finishDelete.promise;return response({id:'owned-job',status:'cancelled'});}return response({id:'owned-job',status:'running'});};
 const client=new JobClient();const first=client.run({},()=>started.resolve()).catch(e=>e);await started.promise;
 // First run has its ID before its polling pause. Start replacement while DELETE waits.
 await Promise.resolve();const replacement=client.run({new:true},()=>{}).catch(e=>e);await deleteStarted.promise;const disposed=client.cancel();finishDelete.resolve();await disposed;
 // Flush the continuation after DELETE, then cancel any resurrected request so a
 // broken implementation fails promptly instead of leaving the test polling.
 await new Promise(resolve=>setTimeout(resolve,0));await client.cancel();await replacement;await first;
 assert.equal(posts,1,'Navigation during pending DELETE must not submit a replacement job');
 console.log('PASS: cancellation during replacement cleanup cannot resurrect a job');
 const postStarted=pending(),postFinish=pending(),removed=[];
 globalThis.fetch=async(url,init)=>{if(init?.method==='POST'){postStarted.resolve();await postFinish.promise;return response({id:'late-owned',status:'running'});}if(init?.method==='DELETE'){removed.push(url);return response({status:'cancelled'});}throw new Error('Unexpected polling');};
 const lateClient=new JobClient(),late=lateClient.run({late:true},()=>{}).catch(e=>e);await postStarted.promise;await lateClient.cancel();postFinish.resolve();assert.equal((await late).name,'AbortError');assert.deepEqual(removed,['/api/jobs/late-owned']);console.log('PASS: late POST is cancelled by its owner');
 let pollStarted=pending(),deletes=[];
 globalThis.fetch=async(url,init)=>{if(init?.method==='POST')return response({id:'hung-owned',status:'running'});if(init?.method==='DELETE'){deletes.push(url);return response({status:'cancelled'});}pollStarted.resolve();return new Promise((resolve,reject)=>{const abort=()=>reject(init.signal.reason);if(init.signal.aborted)abort();else init.signal.addEventListener('abort',abort,{once:true});});};
 const keepAlive=setInterval(()=>{},1000);try{const hung=new JobClient(10,1000).run({hung:true},()=>{}).catch(e=>e);await pollStarted.promise;assert.match((await hung).message,/timed out/);assert.deepEqual(deletes,['/api/jobs/hung-owned']);}finally{clearInterval(keepAlive);}console.log('PASS: hung polling has a deadline and stops its owned job');
 const cacheOut=join(scratch,'cache.mjs');await build({entryPoints:['frontend/src/services/result-cache.ts'],outfile:cacheOut,bundle:true,platform:'node',format:'esm'});const {ResultCache,stableKey}=await import(pathToFileURL(cacheOut));
 const cache=new ResultCache(100,2,1000);cache.set('a','1234567890');cache.set('b','1234567890');cache.get('a');cache.set('c','1234567890');assert.equal(cache.get('b'),undefined);assert.equal(cache.size,2);assert.ok(cache.retainedBytes<=100);cache.set('large','x'.repeat(51));assert.equal(cache.size,2);assert.equal(stableKey({b:[2,1],a:1}),stableKey({a:1,b:[2,1]}));assert.notEqual(stableKey({a:1}),stableKey({a:2}));console.log('PASS: bounded LRU and complete scientific cache keys');
}finally{await rm(scratch,{recursive:true,force:true});}
