import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();});
test('spectroscopy, selection rules, series, CSV and PNG',async({page})=>{
  await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('656.');
  await expect(page.locator('.result-heading p')).toContainText('allowed');
  await page.locator('[name="i_l"]').fill('0');
  await expect(page.locator('[data-result]')).toBeHidden();
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading p')).toContainText('forbidden');
  await page.locator('[name="lower"]').selectOption('1');
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-results h3')).toContainText('Lyman');
  const csv=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();expect((await csv).suggestedFilename()).toBe('quantum-spectrum.csv');
  const png=page.waitForEvent('download');await page.getByRole('button',{name:'Export graph PNG'}).click();expect(await (await png).failure()).toBeNull();
});
test('measurement samples, reproducibility, saved parameters and validated defaults',async({page})=>{
  await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('2,000');
  await expect(page.locator('.lab-table-scroll')).toContainText('0.577350');
  await page.locator('[name="count"]').fill('4000');
  await page.getByRole('button',{name:'Save parameters',exact:true}).click();
  await page.getByRole('button',{name:'Defaults',exact:true}).click();
  await expect(page.locator('[name="count"]')).toHaveValue('2000');
  await page.getByRole('button',{name:'Restore saved',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('4,000');
  const before=await page.locator('[name="seed"]').inputValue();
  await page.getByRole('button',{name:'New independent batch'}).click();
  await expect(page.locator('[name="seed"]')).not.toHaveValue(before);
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();
  await expect(page.locator('#viewport canvas')).toBeVisible();
});
test('lab input errors, in-flight cancellation, loading and server failure',async({page})=>{
  await page.getByRole('button',{name:'Spectroscopy',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await page.locator('[name="i_l"]').fill('3');
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toContainText('Calculation failed');
  await page.getByRole('button',{name:'Defaults',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  let release!:()=>void;
  const waiting=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/spectroscopy?**',async route=>{
    await waiting;await route.fulfill({status:500,contentType:'application/json',body:'{"error":"Obsolete failure"}'}).catch(()=>{});
  });
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculating…');
  await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  release();
  await expect(page.locator('.lab-status')).not.toContainText('Obsolete');
  await page.route('**/api/measurement?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Capacity reached"}'}));
  await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toContainText('Capacity reached');
});
for(const width of [320,768,1024,1440])test(`scientific labs fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  for(const name of ['Spectroscopy','Quantum Experiments']){
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByText('Scientific assumptions & interpretation',{exact:true})).toBeVisible();
  }
});
