// Actual Chrome screenshots and presentation metrics, separate from correctness tests.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.addInitScript(()=>{
 window.gpuAudit={created:0,deleted:0,draws:0};
 for(const type of [WebGLRenderingContext,WebGL2RenderingContext])for(const method of ['createBuffer','deleteBuffer','drawArrays','drawElements']){
  const original=type.prototype[method];type.prototype[method]=function(...args){if(method==='createBuffer')window.gpuAudit.created++;else if(method==='deleteBuffer')window.gpuAudit.deleted++;else window.gpuAudit.draws++;return original.apply(this,args);};
 }
});
const start=performance.now();await page.goto('http://127.0.0.1:8766');await page.locator('#loading').waitFor({state:'hidden'});const load=performance.now()-start;
async function choose(lab,tool){await page.getByRole('button',{name:lab,exact:true}).click();if(tool)await page.getByRole('button',{name:tool,exact:true}).click();await page.waitForFunction(()=>document.querySelector('.lab-status')?.textContent==='Calculation complete.');}
await choose('Molecular Lab');await page.locator('[name="system"] option[value="o2"]').waitFor({state:'attached'});await page.locator('[name="system"]').selectOption('o2');await page.waitForFunction(()=>document.querySelector('.lab-status')?.textContent==='Calculation complete.');await page.screenshot({path:new URL('../docs/quantum-lab-3-molecular.png',import.meta.url).pathname});
await choose('Molecular Lab','Vibrational analysis');await page.locator('[name="system"]').selectOption('water');await page.getByRole('button',{name:'Calculate',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.lab-status')?.textContent==='Calculation complete.');await page.screenshot({path:new URL('../docs/quantum-lab-3-vibrations.png',import.meta.url).pathname});
await choose('Quantum Dynamics','3D atomic evolution');await page.screenshot({path:new URL('../docs/quantum-lab-3-atomic-dynamics.png',import.meta.url).pathname});
const initial=await page.evaluate(()=>({...window.gpuAudit}));await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(1500);await page.getByRole('button',{name:'Pause',exact:true}).click();const playing=await page.evaluate(()=>({...window.gpuAudit}));await page.waitForTimeout(400);const idle=await page.evaluate(()=>({...window.gpuAudit}));
const frameIntervals=await page.evaluate(()=>new Promise(resolve=>{const samples=[];let last;function tick(now){if(last!==undefined)samples.push(now-last);last=now;if(samples.length<60)requestAnimationFrame(tick);else resolve(samples);}requestAnimationFrame(tick);}));
await page.setViewportSize({width:390,height:900});await choose('Quantum Materials');await page.screenshot({path:new URL('../docs/quantum-lab-3-mobile.png',import.meta.url).pathname});
const report={viewport:{width:1440,height:1000},load_to_atomic_ready_ms:load,atomic_playback_1500ms:{draw_call_increase:playing.draws-initial.draws,buffer_creation_increase:playing.created-initial.created,buffer_deletion_increase:playing.deleted-initial.deleted},idle_400ms_draw_call_increase:idle.draws-playing.draws,median_animation_frame_interval_ms:frameIntervals.sort((a,b)=>a-b)[30],mobile_document_width:await page.evaluate(()=>document.documentElement.scrollWidth),console_errors:errors,measurement_note:'Single headless Chrome run, scheduling interval is not measured GPU execution/FPS. On-demand rendering and max 10 Hz data playback are intentional. Counts cover instrumented WebGL calls during this workload, not all driver allocations or total GPU memory.'};
await writeFile(new URL('../docs/browser-audit3.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));await browser.close();
