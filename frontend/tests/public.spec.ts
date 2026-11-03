import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('.public-demo-notice')).toContainText('Resource-bounded public demo');});
test('public atomic s/p/d/f preview, camera, periodic table and image export',async({page})=>{
 await expect(page.locator('#quality')).toHaveValue('preview');await expect(page.locator('#quality option[value="high"]')).toHaveJSProperty('disabled',true);
 for(const family of [1,2,3]){await page.locator(`[data-family="${family}"]`).click();await expect(page.locator('#loading')).toBeHidden();}
 await page.locator('#surface').click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#viewport-caption')).toContainText('49³');
 const canvas=page.locator('#viewport canvas'),box=await canvas.boundingBox();expect(box).not.toBeNull();
 await page.mouse.move(box!.x+box!.width*.5,box!.y+box!.height*.5);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.65,box!.y+box!.height*.6,{steps:8});await page.mouse.up();await page.mouse.wheel(0,100);
 const download=page.waitForEvent('download');await page.locator('#export').click();expect(await(await download).failure()).toBeNull();
 await page.locator('#open-table').click();await page.locator('#element-search').fill('Iron');await page.locator('[data-z="26"]').click();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#p-count')).toHaveText('26');
});
test('public molecular viewer and honest advanced-mode availability',async({page})=>{
 await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('.lab-results')).toContainText('41³');
 await page.getByRole('button',{name:'MO reference diagrams',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await page.getByRole('button',{name:'Geometry optimization',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Available in advanced local mode.');await expect(page.locator('.lab-results')).toContainText('does not run expensive chemistry');
});
test('public spectroscopy graph export works with production CSP',async({page})=>{
 await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export graph PNG',exact:true}).click();expect(await(await file).failure()).toBeNull();
});
test('public quantum dynamics and compatible measurement batches',async({page})=>{
 await page.getByRole('button',{name:'Quantum Dynamics',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await page.getByRole('button',{name:'Add independent batch',exact:true}).click();await expect(page.locator('.result-heading h2')).toContainText('4,000');
 await page.getByRole('button',{name:'Reset measurements',exact:true}).click();await expect(page.locator('.result-heading h2')).toContainText('0 independent');
});
for(const width of [320,768,1440])test(`public materials and accessibility fit ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Quantum Materials',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 if(width===1440){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);}
});
test('public production rejects expensive input and never calls visitor localhost',async({page})=>{
 const origin=new URL(page.url()).origin;
 const response=await page.request.post('/api/jobs',{data:{operation:'scf',request:{system:'water'}}});expect(response.status()).toBe(503);expect((await response.json()).error).toContain('advanced local mode');
 expect((await page.request.get('/api/orbital?quality=high')).status()).toBe(400);
 await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('.lab-results')).toContainText('Selected benchmark method');
 await page.getByRole('button',{name:'Electron correlation',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Available in advanced local mode.');
 const urls=await page.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('/api/')));expect(urls.every(url=>new URL(url).origin===origin)).toBe(true);
});
