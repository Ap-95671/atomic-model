import { test,expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');});
test('SCF energies, electron counts, basis expansion and density',async({page})=>{
  await expect(page.locator('.result-heading h2')).toContainText('-1.116714325');
  await expect(page.locator('[data-computation-view] canvas')).toBeVisible();
  await page.locator('[name="system"]').selectOption('he');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('-2.807783957');
  await page.locator('[name="view"]').selectOption('lumo');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toContainText('no virtual orbital');
  await page.locator('[name="basis"]').selectOption('uncontracted-sto-3g');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('-2.816246308');
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export matrices & result JSON'}).click();expect(await(await file).failure()).toBeNull();
});
for(const width of [320,768,1440])test(`computational workspace fits ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
