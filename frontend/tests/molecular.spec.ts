import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');});
test('calculated molecular surfaces, separation, energies and exports',async({page})=>{
  await expect(page.locator('[data-molecular-view] canvas')).toBeVisible();
  await expect(page.locator('.result-metrics')).toContainText('0.586453');
  await page.locator('[name="orbital"]').selectOption('antibonding');
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('antibonding');
  await page.locator('[name="distance"]').fill('3');
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading p')).toContainText('R=3.000');
  await page.getByRole('button',{name:'Reset camera',exact:true}).click();
  const image=page.waitForEvent('download');await page.getByRole('button',{name:'Export orbital PNG'}).click();expect(await(await image).failure()).toBeNull();
  const data=page.waitForEvent('download');await page.getByRole('button',{name:'Export bond-curve CSV'}).click();expect((await data).suggestedFilename()).toBe('quantum-h2plus-bond.csv');
  await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();
  await expect(page.locator('#viewport canvas')).toBeVisible();
});
for(const width of [320,768,1024,1440])test(`molecular workspace fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await expect(page.locator('[data-molecular-view] canvas')).toBeVisible();
});
