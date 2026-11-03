import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async({page})=>{
 await page.route('**/api/**',r=>r.abort());
 await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('.public-demo-notice')).toContainText('BROWSER DEMO');
});
test('static build performs real s/p/d/f calculations, camera actions and labeled PNG export',async({page})=>{
 const calls:string[]=[];page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});
 await expect(page.locator('#quality')).toHaveValue('preview');await expect(page.locator('#points')).toHaveAttribute('max','8000');
 for(const family of [1,2,3]){await page.locator(`[data-family="${family}"]`).click();await expect(page.locator('#loading')).toBeHidden();await page.locator('#surface').click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#viewport-caption')).toContainText('41³');}
 await page.locator('#basis').selectOption('complex');await page.locator('#orientation').selectOption('3');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#legend')).toContainText('arg(ψ)');
 const canvas=page.locator('#viewport canvas'),box=(await canvas.boundingBox())!;await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6,{steps:5});await page.mouse.up();await page.mouse.wheel(0,-200);
 const download=page.waitForEvent('download');await page.locator('#export').click();expect(await(await download).failure()).toBeNull();expect(calls).toEqual([]);
});
test('elements, isotopes, ions and atomic URL state work without an API',async({page})=>{
 await page.locator('#isotope').selectOption('2');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#neutron-info')).toContainText('1');
 await page.locator('#open-table').click();await page.getByLabel('Search element').fill('Iron');await page.getByRole('button',{name:/Fe.*Iron/}).click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#element-name')).toHaveText('Iron');
 await page.locator('#charge').fill('2');await page.locator('#charge').press('Enter');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#electron-info')).toContainText('24');await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#element-name')).toHaveText('Iron');await expect(page.locator('#charge')).toHaveValue('2');
});
test('interactive H2+ energies, exponent optimization, antibonding surface and CSV',async({page})=>{
 await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('.result-metrics')).toContainText('-0.553771');
 await page.locator('[name="optimize"]').selectOption('true');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('.lab-results')).toContainText('ζ=1.238697');await expect(page.locator('.result-metrics')).toContainText('-0.586506');
 await page.locator('[name="orbital"]').selectOption('antibonding');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('.result-heading')).toContainText('antibonding');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export bond-curve CSV'}).click();expect(await(await download).failure()).toBeNull();
});
test('recorded O2 and water orbitals retain parameters, provenance and honest labels',async({page})=>{
 await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await expect(page.locator('[name="system"] option[value="o2"]')).toHaveCount(1);await page.locator('[name="system"]').selectOption('o2');await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');await expect(page.locator('.execution-note')).toContainText('PRECOMPUTED');await expect(page.locator('.result-metrics')).toContainText('9.000 / 7.000');
 await page.locator('[name="channel"]').selectOption('beta');await page.locator('[name="field"]').selectOption('lumo');await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');await page.reload();await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');await expect(page.locator('[name="system"]')).toHaveValue('o2');await expect(page.locator('[name="field"]')).toHaveValue('lumo');
 await page.locator('[name="system"]').selectOption('water');await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');await expect(page.locator('.result-heading')).toContainText('-74.964447583');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export recorded result JSON'}).click();expect(await(await download).failure()).toBeNull();
 await page.getByRole('link',{name:'live browser LCAO model'}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('#lab-workspace h1')).toHaveText('Molecular Lab');
});
test('all four recorded datasets and fields work in Computational Chemistry',async({page})=>{
 await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');
 for(const system of ['h2','n2','o2','water']){await page.locator('[name="system"]').selectOption(system);await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');for(const field of ['homo','lumo','density','spin-density']){await page.locator('[name="field"]').selectOption(field);await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');await expect(page.locator('[data-recorded-view] canvas')).toBeVisible();}}
});
test('spectroscopy calculates vacuum wavelengths and exports CSV and graph PNG',async({page})=>{
 await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('.result-heading')).toContainText('656.');await expect(page.locator('.result-heading')).toContainText('allowed');await expect(page.locator('.execution-note')).toContainText('precomputed coefficients');
 for(const name of ['Export CSV','Export graph PNG']){const download=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();expect(await(await download).failure()).toBeNull();}
});
test('measurement samples accumulate/reset and circuit Bell state is calculated',async({page})=>{
 await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();await expect(page.locator('.result-heading h2')).toContainText('2,000');await page.getByRole('button',{name:'Add independent batch'}).click();await expect(page.locator('.result-heading h2')).toContainText('4,000');await page.getByRole('button',{name:'Reset measurements'}).click();await expect(page.locator('.result-heading h2')).toContainText('0 independent');
 await page.getByRole('button',{name:'Quantum computing',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('.result-metrics')).toContainText('0.5000000');await expect(page.locator('.result-metrics')).toContainText('1.0000000 bits');await page.getByRole('button',{name:'H₂ molecular VQE',exact:true}).click();await expect(page.locator('.lab-status')).toContainText('advanced local');
});
test('well playback, unavailable tools and material models remain explicit',async({page})=>{
 await page.getByRole('button',{name:'Quantum Dynamics',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();await page.getByRole('button',{name:'General superpositions',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Unavailable in browser mode.');await expect(page.locator('[data-result]')).toContainText('No calculation was performed');
 await page.getByRole('button',{name:'Quantum Materials',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');for(const model of ['chain','square','honeycomb']){await page.locator('[name="model"]').selectOption(model);await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await expect(page.locator('[data-lattice-view] canvas')).toBeVisible();}
});
for(const width of [320,768,1440])test(`static interface fits ${width}px and has accessible controls`,async({page})=>{
 await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Precomputed dataset ready.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 if(width===1440){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);}
});
test('static traffic, build provenance and direct-link history have no backend dependency',async({page,context})=>{
 const calls:string[]=[];context.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/')||u.origin!==new URL(page.url()).origin&&!['data:','blob:'].includes(u.protocol))calls.push(r.url());});
 await page.goto('/#lab=dynamics&tool=two');await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Browser result ready.');await page.goBack();await expect(page.locator('#lab-workspace h1')).toHaveText('Quantum Dynamics');await page.reload();await expect(page.locator('#lab-workspace h1')).toHaveText('Quantum Dynamics');expect(calls).toEqual([]);
 const info=await(await page.request.get('/build-info.json')).json();expect(info.mode).toBe('browser-static');expect(info.api_backend).toBe(false);expect(info.python_runtime).toBe(false);
});
