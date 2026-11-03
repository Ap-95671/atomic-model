import {test,expect} from '@playwright/test';
const routes:[string,string,string?,string?][]=[
 ['molecular','Molecular Lab','lcao'],['molecular','Molecular Lab','diagrams'],['molecular','Molecular Lab','geometry'],['molecular','Molecular Lab','vibrations'],['molecular','Molecular Lab','structures'],
 ['dynamics','Quantum Dynamics','two'],['dynamics','Quantum Dynamics','general'],['dynamics','Quantum Dynamics','atomic'],
 ['experiments','Quantum Experiments','measurement'],['experiments','Quantum Experiments','tunneling'],['experiments','Quantum Experiments','quantum','circuits'],['experiments','Quantum Experiments','quantum','vqe'],['experiments','Quantum Experiments','open'],['experiments','Quantum Experiments','fields'],
 ['computation','Computational Chemistry','foundation'],['computation','Computational Chemistry','pyscf'],['computation','Computational Chemistry','adaptive'],['computation','Computational Chemistry','correlation'],['computation','Computational Chemistry','excitations'],['computation','Computational Chemistry','bond_scan'],['computation','Computational Chemistry','spin-aware'],
 ['spectroscopy','Spectroscopy'],['materials','Quantum Materials']];
for(const [lab,label,tool,sub] of routes)test(`direct link and refresh preserve ${lab}/${tool??''}/${sub??''}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const hash=new URLSearchParams({lab,...tool?{tool}:{},...sub?{sub}:{}});
 let scfPosts=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/jobs')&&JSON.parse(r.postData()!).operation==='scf')scfPosts++;});
 await page.goto('/#'+hash);await expect(page.locator('.lab-nav [aria-pressed="true"]')).toHaveText(label);await expect(page.locator('.lab-status')).toHaveText('Calculation complete.',{timeout:30000});
 const title=await page.locator('#lab-workspace h1').innerText();await page.reload();
 await expect(page.locator('.lab-nav [aria-pressed="true"]')).toHaveText(label);await expect(page.locator('#lab-workspace h1')).toHaveText(title);await expect(page.locator('.lab-status')).toHaveText('Calculation complete.',{timeout:30000});
 expect(new URL(page.url()).hash).toContain(`lab=${lab}`);if(tool)expect(new URL(page.url()).hash).toContain(`tool=${tool}`);if(sub)expect(new URL(page.url()).hash).toContain(`sub=${sub}`);
 // Geometry/correlation/etc deep links must not first submit default H2 SCF.
 if(tool!=='spin-aware')expect(scfPosts).toBe(0);expect(errors).toEqual([]);
});
test('Back/Forward and parameters survive without duplicate mounts or repeated science',async({page})=>{
 await page.goto('/#lab=spectroscopy');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.locator('[name="lower"]').selectOption('1');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 let requests=0;page.on('request',r=>{if(r.url().includes('/api/spectroscopy?'))requests++;});
 await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await page.getByRole('button',{name:'MO reference diagrams',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.goBack();await expect(page.locator('#lab-workspace h1')).toHaveText('Molecular Lab');await page.goBack();await expect(page.locator('#lab-workspace h1')).toHaveText('Spectroscopy');await expect(page.locator('[name="lower"]')).toHaveValue('1');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(requests).toBe(0);
 await page.goForward();await expect(page.locator('#lab-workspace h1')).toHaveText('Molecular Lab');await page.goForward();await expect(page.locator('#lab-workspace h1')).toHaveText('Molecular Orbital Diagrams');await expect(page.locator('form')).toHaveCount(1);
 await page.evaluate(()=>{location.hash='lab=materials';});await expect(page.locator('#lab-workspace h1')).toHaveText('Quantum Materials');
});
test('atomic state, isotope and mode survive refresh; invalid URLs fall back safely',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.locator('#orbital-scope').selectOption('explore');await page.locator('[data-family="3"]').click();await expect(page.locator('#orbital-title')).toContainText('4f');await page.locator('#surface').click();await expect(page.locator('#loading')).toBeHidden();await page.locator('#isotope').selectOption('2');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-tab="radial"]').click();await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#orbital-title')).toContainText('4f');await expect(page.locator('#surface')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#isotope')).toHaveValue('2');await expect(page.locator('[data-tab="radial"]')).toHaveAttribute('aria-selected','true');
 const historyBefore=await page.evaluate(()=>history.length);await page.locator('.skip-link').focus();await page.locator('.skip-link').press('Enter');await expect(page.locator('#viewport canvas')).toBeFocused();expect(await page.evaluate(()=>history.length)).toBe(historyBefore);
 await page.goto('/#lab=invalid&tool=broken');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('.lab-nav [aria-pressed="true"]')).toHaveText('Atomic Explorer');
 await page.goto('/#lab=experiments&tool=not-a-tool&params=bad-json');await expect(page.locator('#lab-workspace h1')).toHaveText('Quantum Measurements');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
});
test('rapid navigation and obsolete failures do not own the new view',async({page})=>{
 await page.goto('/#lab=spectroscopy');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 let release!:()=>void;const waiting=new Promise<void>(r=>release=r);let requested!:()=>void;const started=new Promise<void>(r=>requested=r);
 await page.route('**/api/spectroscopy?**',async route=>{requested();await waiting;await route.fulfill({status:500,contentType:'application/json',body:'{"error":"obsolete response"}'}).catch(()=>{});});
 await page.locator('[name="lower"]').selectOption('1');await page.getByRole('button',{name:'Calculate',exact:true}).click();await started;
 for(const lab of ['Molecular Lab','Quantum Dynamics','Quantum Experiments','Quantum Materials'])await page.getByRole('button',{name:lab,exact:true}).click();
 release();await expect(page.locator('#lab-workspace h1')).toHaveText('Quantum Materials');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('.lab-status')).not.toContainText('obsolete');await expect(page.locator('form')).toHaveCount(1);await expect(page.locator('#lab-workspace canvas')).toHaveCount(1);
});
test('same active laboratory is a no-op, and identical calculations reuse results',async({page})=>{
 await page.goto('/#lab=molecular');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');let calls=0;page.on('request',r=>{if(r.url().includes('/api/molecular?'))calls++;});const canvas=await page.locator('[data-molecular-view] canvas').elementHandle();
 await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();expect(await page.locator('[data-molecular-view] canvas').evaluate((el,previous)=>el===previous,canvas)).toBe(true);
 await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(calls).toBe(0);
 await page.locator('[name="distance"]').fill('3');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(calls).toBe(1);await expect(page.locator('.result-heading')).toContainText('R=3.000');
});
test('navigating away cancels only the owned live process; return uses identical completed job',async({page})=>{
 await page.goto('/#lab=computation&tool=spin-aware');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');let posts=0;page.on('request',r=>{if(r.url().endsWith('/api/jobs')&&r.method()==='POST')posts++;});
 await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(posts).toBe(0);
 await page.locator('[name="system"]').selectOption('benzene');await page.locator('[name="basis"]').selectOption('cc-pvdz');await page.locator('[name="method"]').selectOption('b3lyp');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/jobs')&&r.request().method()==='POST');await page.getByRole('button',{name:'Calculate',exact:true}).click();const id=(await(await created).json()).id;
 const other=await page.request.post('/api/jobs',{data:{operation:'scf',request:{system:'benzene',basis:'cc-pvdz',method:'b3lyp',quality:'preview'}}});expect(other.ok()).toBeTruthy();const unrelated=(await other.json()).id;
 try{await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await expect.poll(async()=>(await(await page.request.get(`/api/jobs/${id}`)).json()).status).toBe('cancelled');expect((await(await page.request.get(`/api/jobs/${unrelated}`)).json()).status).not.toBe('cancelled');}finally{await page.request.delete(`/api/jobs/${unrelated}`);}
});

test('computed molecular system and orbital restore after refresh without hidden default SCF',async({page})=>{
 await page.goto('/#lab=molecular');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('[name="system"] option[value="o2"]')).toHaveCount(1);await page.locator('[name="system"]').selectOption('o2');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.locator('[name="orbital"]').selectOption('0');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await page.locator('[name="channel"]').selectOption('beta');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 const submitted:string[]=[];page.on('request',r=>{if(r.url().endsWith('/api/jobs')&&r.method()==='POST')submitted.push(JSON.parse(r.postData()!).request?.system);});await page.reload();await expect(page.locator('[data-field-title]')).toHaveText('beta orbital 1');await expect(page.locator('[name="system"]')).toHaveValue('o2');expect(submitted).toEqual(['o2']);
});
test('rapid atomic choices and mode changes render only the current requested state',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();
 await page.locator('#orbital-scope').selectOption('explore'); await page.locator('[data-family="1"]').click();await page.locator('[data-family="2"]').click();await page.locator('[data-family="3"]').click();await page.locator('#surface').click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#orbital-title')).toContainText('4f');await expect(page.locator('#surface')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#atomic-result-status')).toBeHidden();await expect(page.locator('#export')).toBeEnabled();
 await page.getByRole('button',{name:'Quantum Dynamics',exact:true}).click();await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#orbital-title')).toContainText('4f');
});
test('50 complete navigation cycles retain bounded heap, DOM and renderer contexts',async({page})=>{
 test.setTimeout(120000);
 await page.addInitScript(()=>{
  const contexts=new Set<RenderingContext>();(window as unknown as {qalContexts:Set<RenderingContext>}).qalContexts=contexts;
  const get=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(...args:Parameters<typeof get>){const context=get.apply(this,args);if(context&&(args[0]==='webgl2'||args[0]==='webgl'))contexts.add(context);return context;} as typeof get;
 });
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();
 const labs=['Molecular Lab','Spectroscopy','Quantum Dynamics','Quantum Experiments','Computational Chemistry','Quantum Materials'];
 const cycle=async()=>{for(const name of labs){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');}await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await expect(page.locator('#loading')).toBeHidden();};
 await cycle();const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage'),domBefore=await cdp.send('Memory.getDOMCounters');
 for(let i=0;i<50;i++)await cycle();await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage'),domAfter=await cdp.send('Memory.getDOMCounters');
 expect(after.usedSize-before.usedSize).toBeLessThan(5*1024*1024);expect(domAfter.nodes-domBefore.nodes).toBeLessThan(500);expect(domAfter.jsEventListeners-domBefore.jsEventListeners).toBeLessThan(10);
 expect(await page.evaluate(()=>(window as unknown as {qalContexts:Set<RenderingContext>}).qalContexts.size)).toBeLessThanOrEqual(2);await expect(page.locator('#lab-workspace canvas')).toHaveCount(0);expect(errors).toEqual([]);
});
