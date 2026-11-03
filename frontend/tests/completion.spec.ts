import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFile} from 'node:fs/promises';

test('prepare hydrogen 2p, preserve electron count and restore its actual occupancy',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();
 await page.locator('#prepare-configuration').click();await page.getByRole('button',{name:'Move electron',exact:true}).click();await expect(page.locator('#prepared-summary')).toHaveText('2p1');
 await page.getByRole('button',{name:'Use prepared configuration',exact:true}).click();await expect(page.locator('#orbital-title')).toHaveText('2p_z');await expect(page.locator('#e-count')).toHaveText('1');await expect(page.locator('.configuration')).toHaveText('2p1');await expect(page.locator('.config-status')).toContainText('Pauli exclusion');
 await page.reload();await expect(page.locator('#orbital-scope')).toHaveValue('prepared');await expect(page.locator('#orbital-title')).toHaveText('2p_z');await expect(page.locator('#occupied-picker button')).toHaveText('2p1');
 await page.locator('#orbital-scope').selectOption('ground');await expect(page.locator('#orbital-title')).toHaveText('1s');await expect(page.locator('.configuration')).toHaveText('1s1');
});
test('preparation rejects Pauli violations and invalid quantum numbers without changing the atom',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.locator('#open-table').click();await page.locator('[data-z="2"]').click();await expect(page.locator('#element-name')).toHaveText('Helium');
 await page.locator('#prepare-configuration').click();await page.locator('#prepare-n').fill('1');await page.locator('#prepare-l').fill('0');await page.locator('#prepare-spin').selectOption('-0.5');await page.getByRole('button',{name:'Move electron',exact:true}).click();await expect(page.locator('#prepare-error')).toContainText('Pauli');
 await page.locator('#prepare-n').fill('2');await page.locator('#prepare-l').fill('2');await page.getByRole('button',{name:'Move electron',exact:true}).click();await expect(page.locator('#prepare-error')).toContainText('l < n');await page.keyboard.press('Escape');await expect(page.locator('.configuration')).toHaveText('1s2');
});
test('periodic reference trends retain unknowns, export values and open occupied orbitals',async({page})=>{
 await page.goto('/#lab=periodic');await expect(page.locator('#periodic-page-grid button')).toHaveCount(118);await page.locator('#periodic-property').selectOption('electronegativity');await page.locator('#periodic-period').selectOption('1');await expect(page.locator('#periodic-range')).toContainText('1 unknown');
 await page.locator('[data-periodic-z="2"]').click();await expect(page.locator('#periodic-detail')).toContainText('Unknown Pauling scale');
 const file=page.waitForEvent('download');await page.locator('#periodic-csv').click();const downloaded=await file;const body=await readFile((await downloaded.path())!,'utf8');expect(body).toContain('Pauling scale');expect(body).toContain('"He"');
 await page.locator('#periodic-period').selectOption('');await page.locator('#periodic-search').fill('carbon');await page.locator('[data-periodic-z="6"]').click();await page.reload();await expect(page.locator('#periodic-search')).toHaveValue('carbon');await expect(page.locator('#periodic-detail h2')).toContainText('Carbon');await page.getByRole('link',{name:'Open occupied orbitals'}).click();await expect(page.locator('#element-name')).toHaveText('Carbon');await expect(page.locator('#orbital-scope')).toHaveValue('ground');
});
test('comparison renders both orbitals with one canvas and independent restorable cameras',async({page})=>{
 await page.goto('/#lab=compare');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('[data-comparison-view] canvas')).toHaveCount(1);await expect(page.locator('[data-pane]')).toHaveCount(2);await expect(page.locator('.comparison-scale')).toContainText('Common frame');
 const pane=page.locator('[data-pane="b"]'),box=(await pane.boundingBox())!;await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.6,{steps:7});await page.mouse.up();await expect.poll(()=>new URL(page.url()).hash).toContain('rightCamera');
 await page.locator('[name="bn"]').fill('3');await page.locator('[name="bl"]').fill('2');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('[data-pane="b"]')).toContainText('3d');await page.reload();await expect(page.locator('[name="bn"]')).toHaveValue('3');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.locator('[name="bl"]').fill('3');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toContainText('failed');
});
test('molecular presentation, display quality, camera state and high-resolution PNG work',async({page})=>{
 await page.goto('/#lab=molecular&tool=structures');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.locator('[data-v-camera]').selectOption('z');await page.locator('[data-v-quality]').selectOption('high');await expect.poll(()=>new URL(page.url()).hash).toContain('view=');
 const original=await page.locator('[data-structure-view] canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));const image=page.waitForEvent('download');await page.locator('[data-v-export2]').click();const file=await image,bytes=await readFile((await file.path())!);expect(bytes.readUInt32BE(16)).toBe(original.width*2);expect(bytes.readUInt32BE(20)).toBeGreaterThan(original.height*2);
 await page.locator('[data-v-presentation]').click();await expect(page.locator('[data-structure-view]')).toHaveClass(/viewport-presenting/);await page.keyboard.press('Escape');await expect(page.locator('[data-structure-view]')).not.toHaveClass(/viewport-presenting/);
 await page.reload();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('[data-v-quality]')).toHaveValue('high');
});
test('atomic camera and individual subshell visibility survive a shared URL',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.locator('#orbital-scope').selectOption('explore');await page.locator('[data-family="1"]').click();await expect(page.locator('#loading')).toBeHidden();await page.locator('#overlay').selectOption('subshell');await expect(page.locator('#loading')).toBeHidden();await page.locator('[data-overlay-state]').first().uncheck();await expect(page.locator('#loading')).toBeHidden();await page.locator('#camera-preset').selectOption('z');await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('[data-overlay-state]').first()).not.toBeChecked();await expect(page.locator('#camera-preset')).toHaveValue('z');
});
for(const route of ['periodic','compare'])for(const width of [390,1440])test(`complete ${route} works at ${width}px with accessible controls`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/#lab='+route);if(route==='compare')await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');else await expect(page.locator('#periodic-page-grid button')).toHaveCount(118);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('new comparison and periodic modules retain bounded memory and two renderer contexts',async({page})=>{
 test.setTimeout(60000);
 await page.addInitScript(()=>{const contexts=new Set<RenderingContext>();(window as unknown as {contexts:Set<RenderingContext>}).contexts=contexts;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args:Parameters<typeof original>){const result=original.apply(this,args);if(result&&String(args[0]).startsWith('webgl'))contexts.add(result);return result;} as typeof original;});
 await page.goto('/#lab=compare');await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');const cdp=await page.context().newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Runtime.getHeapUsage');
 for(let i=0;i<8;i++){await page.getByRole('button',{name:'Periodic Table',exact:true}).click();await expect(page.locator('#periodic-page-grid button')).toHaveCount(118);await page.getByRole('button',{name:'Orbital Comparison',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');}
 await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Runtime.getHeapUsage');expect(after.usedSize-before.usedSize).toBeLessThan(5*1024*1024);expect(await page.evaluate(()=>(window as unknown as {contexts:Set<RenderingContext>}).contexts.size)).toBeLessThanOrEqual(2);
});
test('guided molecular preparation mounts the intended tool and parameters directly',async({page})=>{
 await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'Take a guided tour'}).click();await page.getByRole('button',{name:'Find the H₂⁺ bond minimum',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('[name="distance"]')).toHaveValue('2.5');await expect(page.locator('#lab-workspace h1')).toHaveText('Molecular Lab');
});
