/** Reproducible local browser profile. Does not deploy or modify cloud resources. */
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.QAL_TEST_URL??'http://127.0.0.1:8771';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const requests=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('requestfinished',async req=>{if(new URL(req.url()).pathname.startsWith('/api/')){const r=await req.response();requests.push({path:new URL(req.url()).pathname,duration_ms:req.timing().responseEnd,status:r?.status(),bytes:Number(r?.headers()['content-length']??0)});}});
await page.addInitScript(()=>{
 const stats={buffers:new Set(),textures:new Set(),programs:new Set(),draw_cpu_ms:0,draw_calls:0,long_tasks:[]};window.__qalProfile=stats;
 const proto=WebGL2RenderingContext.prototype,owners=new WeakMap();
 const getExtension=proto.getExtension;proto.getExtension=function(name){const extension=getExtension.call(this,name);if(name!=='WEBGL_lose_context'||!extension)return extension;const gl=this;return{loseContext(){for(const key of ['buffers','textures','programs'])for(const object of stats[key])if(owners.get(object)?.deref()===gl)stats[key].delete(object);extension.loseContext();},restoreContext(){extension.restoreContext();}};};
 for(const [create,remove,key] of [['createBuffer','deleteBuffer','buffers'],['createTexture','deleteTexture','textures'],['createProgram','deleteProgram','programs']]){const c=proto[create],d=proto[remove];proto[create]=function(...args){const object=c.apply(this,args);if(object){stats[key].add(object);owners.set(object,new WeakRef(this));}return object;};proto[remove]=function(object){stats[key].delete(object);return d.call(this,object);};}
 for(const key of ['drawArrays','drawElements']){const fn=proto[key];proto[key]=function(...args){const started=performance.now();try{return fn.apply(this,args);}finally{stats.draw_calls++;stats.draw_cpu_ms+=performance.now()-started;}};}
 new PerformanceObserver(list=>{for(const e of list.getEntries())stats.long_tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});
});
await page.goto(base);await page.locator('#loading').waitFor({state:'hidden'});
const navigate=async(name,tool)=>{const start=performance.now();await page.getByRole('button',{name,exact:true}).click();if(tool)await page.getByRole('button',{name:tool,exact:true}).click();const mounted=performance.now()-start;await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();return{lab:name,tool:tool??'',mount_ms:mounted,complete_ms:performance.now()-start};};
const timings=[];for(const [lab,tool] of [['Molecular Lab',''],['Spectroscopy',''],['Quantum Dynamics',''],['Quantum Experiments',''],['Quantum Materials',''],['Computational Chemistry',''],['Molecular Lab','MO reference diagrams']])timings.push(await navigate(lab,tool));
const refresh={urlBefore:page.url(),selectedBefore:await page.locator('.lab-nav [aria-pressed="true"]').innerText()};await page.reload();await page.locator('#loading').waitFor({state:'hidden'});await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();refresh.after=await page.locator('.lab-nav [aria-pressed="true"]').innerText();
await page.getByRole('button',{name:'Calculated orbitals',exact:true}).click();await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();
const repeatedStart=requests.length,repeated=[];for(let i=0;i<3;i++){await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();repeated.push(await navigate('Molecular Lab'));}
const repeatedRequests=requests.slice(repeatedStart);
const client=await page.context().newCDPSession(page);const samples=[];
const sample=async cycle=>{await client.send('HeapProfiler.collectGarbage');samples.push({cycle,dom:await client.send('Memory.getDOMCounters'),heap:await client.send('Runtime.getHeapUsage'),gpu:await page.evaluate(()=>{const s=window.__qalProfile;return{buffers:s.buffers.size,textures:s.textures.size,programs:s.programs.size,draw_cpu_ms:s.draw_cpu_ms,draw_calls:s.draw_calls};})});};
const visits=['Molecular Lab','Spectroscopy','Quantum Dynamics','Quantum Experiments','Quantum Materials','Computational Chemistry'];
for(const lab of visits)await navigate(lab);await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await page.locator('#loading').waitFor({state:'hidden'});await sample(0);
const cyclesStart=performance.now();for(let cycle=1;cycle<=50;cycle++){for(const lab of visits)await navigate(lab);await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await page.locator('#loading').waitFor({state:'hidden'});if([10,25,50].includes(cycle))await sample(cycle);}
const cyclesMs=performance.now()-cyclesStart;
const stressLongTasks=await page.evaluate(()=>window.__qalProfile.long_tasks);
const first=samples[0],last=samples.at(-1);assert.ok(last.heap.usedSize-first.heap.usedSize<5*1024*1024,'Retained JS heap must remain bounded');assert.ok(last.dom.nodes-first.dom.nodes<500,'Detached DOM must not accumulate');assert.deepEqual([last.gpu.buffers,last.gpu.textures,last.gpu.programs],[first.gpu.buffers,first.gpu.textures,first.gpu.programs]);
const rootListeners={};for(const expression of ['window','document']){const object=(await client.send('Runtime.evaluate',{expression})).result;const list=(await client.send('DOMDebugger.getEventListeners',{objectId:object.objectId})).listeners;rootListeners[expression]=list.map(v=>({type:v.type,description:v.handler?.description,useCapture:v.useCapture}));}
if(process.env.QAL_HEAP_SNAPSHOT==='1'){const chunks=[];client.on('HeapProfiler.addHeapSnapshotChunk',v=>chunks.push(v.chunk));await client.send('HeapProfiler.takeHeapSnapshot');await fs.writeFile('/tmp/qal-navigation.heapsnapshot',chunks.join(''));}
console.log(JSON.stringify({rootListeners},null,2));
await page.goto(base+'/#lab=computation&tool=spin-aware');await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();
const responses=[];page.on('response',async r=>{if(/\/api\/jobs\//.test(r.url())){try{const j=await r.json();if(j.status==='succeeded')responses.push(j.result?.resources);}catch{}}});
await page.locator('[name="distance"]').fill('1.45');await page.getByRole('button',{name:'Calculate',exact:true}).click();await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();
const output={scope:'Actual local Chrome + Python, port '+new URL(base).port+'; post-GC JS heap and live GL object counts, not total GPU/OS memory. Driver draw-call CPU time is not GPU execution time.',refresh,timings,repeated,repeated_requests:repeatedRequests,stress:{full_cycles:50,navigation_changes:350,wall_ms:cyclesMs,samples,long_tasks:stressLongTasks},requests,worker_resources:responses,long_tasks:await page.evaluate(()=>window.__qalProfile.long_tasks),errors};
await fs.writeFile('/tmp/qal-navigation-after.json',JSON.stringify(output,null,2));await page.screenshot({path:'/tmp/qal-navigation-verified.png'});console.log(JSON.stringify({refresh,repeated,repeatedRequests,stress:output.stress,worker_resources:responses,errors},null,2));await browser.close();
