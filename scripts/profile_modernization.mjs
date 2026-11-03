/** Same bounded workflow before/after; local Chrome timings, not a GPU benchmark. */
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.addInitScript(()=>{
  window.profileTasks=[];
  new PerformanceObserver(list=>window.profileTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const start=performance.now();await page.goto('http://127.0.0.1:8771/#lab=atomic');
 await page.locator('#loading').waitFor({state:'hidden'});
 const first_ready_ms=performance.now()-start;
 const names=['Molecular Lab','Spectroscopy','Quantum Dynamics','Quantum Experiments','Computational Chemistry','Quantum Materials'];
 const passes=[];
 const cdp=await page.context().newCDPSession(page);
 const sample=async()=>{await cdp.send('HeapProfiler.collectGarbage');return{heap:await cdp.send('Runtime.getHeapUsage'),dom:await cdp.send('Memory.getDOMCounters')};};
 let before;
 for(let pass=0;pass<4;pass++){
  const timings=[];
  for(const name of names){const started=performance.now();await page.getByRole('button',{name,exact:true}).click();await page.locator('.lab-status').filter({hasText:'Calculation complete.'}).waitFor();timings.push({name,ready_ms:performance.now()-started});}
  await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await page.locator('#loading').waitFor({state:'hidden'});
  passes.push(timings);if(pass===0)before=await sample();
 }
 const after=await sample(),long_tasks_ms=await page.evaluate(()=>window.profileTasks);
 await page.setViewportSize({width:390,height:844});
 const mobile={width:390,scroll_width:await page.evaluate(()=>document.documentElement.scrollWidth)};
 const output={scope:'Local headless Chrome, 1440×1000, four passes, completed calculations; warmed server/cache; post-GC heap is not total process memory.',first_ready_ms,passes,before,after,long_tasks_ms,mobile,errors};
 await writeFile(process.argv[2]??'/tmp/atomic-modernization-profile.json',JSON.stringify(output,null,2)+'\n');
 console.log(JSON.stringify({first_ready_ms,passes,heap_delta:after.heap.usedSize-before.heap.usedSize,mobile,errors},null,2));
} finally {await browser.close();}
