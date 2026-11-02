import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();});
test('general normalized superpositions edit coefficients and reject invalid bases',async({page})=>{
 await page.getByRole('button',{name:'Quantum Dynamics',exact:true}).click();await page.getByRole('button',{name:'General superpositions',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await expect(page.locator('.lab-results')).toContainText('Normalized finite-state evolution');await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await page.locator('[name="real"]').fill('[1,0,0,0]');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export expectation CSV'}).click();expect(await(await file).failure()).toBeNull();
 await page.locator('[name="states"]').fill('[1,1]');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toContainText('distinct');await expect(page.locator('[data-result]')).toBeHidden();
});
test('3D hydrogenic time evolution preserves canvas during weighted-density playback',async({page})=>{
 await page.getByRole('button',{name:'Quantum Dynamics',exact:true}).click();await page.getByRole('button',{name:'3D atomic evolution',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await expect(page.locator('[data-atomic-time-view] canvas')).toBeVisible();await expect(page.locator('.lab-results')).toContainText('not electron trajectories');
 const canvas=await page.locator('[data-atomic-time-view] canvas').elementHandle();await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(350);await page.getByRole('button',{name:'Pause',exact:true}).click();expect(await page.locator('[data-atomic-time-view] canvas').evaluate((el,prior)=>el===prior,canvas)).toBe(true);
 await expect(page.locator('[data-current]')).not.toHaveText('0.00000');await page.getByRole('button',{name:'Rewind',exact:true}).click();await expect(page.locator('[data-current]')).toHaveText('0.00000');
});
for(const width of [320,768,1440])test(`Lindblad dynamics fits ${width}px and exports density matrices`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();await page.getByRole('button',{name:'Decoherence',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 await expect(page.locator('[data-bloch-view] canvas')).toBeVisible();await expect(page.locator('[data-density-matrix]')).toContainText('0.500000');
 await page.locator('[data-time]').fill('10');await page.locator('[data-time]').dispatchEvent('input');await expect(page.locator('[data-state-metrics]')).toContainText('t=10.000');
 const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export density evolution JSON'}).click();expect(await(await file).failure()).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
