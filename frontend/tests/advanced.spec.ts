import { test,expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();});
test('zero fields, genuine Stark mixing and angular-momentum constraints',async({page})=>{
  await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();await page.getByRole('button',{name:'Fields & Spin',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await page.locator('[name="electric"]').fill('0.000001');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-results')).toContainText('8.163416e-5 eV');
  await page.locator('[name="l"]').selectOption('0');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toContainText('Require j');
  await page.locator('[name="j"]').selectOption('.5');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
});
test('reference O2/He2 diagrams and sourced molecular geometry',async({page})=>{
  await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await page.getByRole('button',{name:'MO reference diagrams',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('O₂');
  await expect(page.locator('.lab-results')).toContainText('two unpaired electrons');
  await page.locator('[name="name"]').selectOption('he2');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-results')).toContainText('zero elementary covalent bond order');
  await page.getByRole('button',{name:'3D structures',exact:true}).click();
  await expect(page.locator('[data-structure-view] canvas')).toBeVisible();
  await page.locator('[name="name"]').selectOption('benzene');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('C₆H₆');
  await expect(page.locator('.result-heading a')).toHaveAttribute('href','https://pubchem.ncbi.nlm.nih.gov/compound/241');
  await expect(page.locator('.lab-results')).toContainText('not a measured equilibrium geometry');
});
test('optional DFT convergence, same-geometry HF comparison, export and unavailable engine',async({page})=>{
  test.setTimeout(60_000);
  const probe=await page.request.get('/api/computation/pyscf?system=h2&method=pbe');
  const response=await probe.json();
  test.skip(probe.status()===503 && /not installed/.test(response.error||''),'Optional PySCF not installed');
  expect(probe.ok()).toBeTruthy();
  await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await page.getByRole('button',{name:'Optional HF / DFT',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.',{timeout:30_000});
  await expect(page.locator('.result-heading h2')).toContainText('-1.152065455');
  await page.locator('[name="compare"]').selectOption('true');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-results')).toContainText('HF total: -1.116714325');
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export orbital CSV'}).click();expect(await(await file).failure()).toBeNull();
  await page.route('**/api/computation/pyscf?**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"Optional PySCF not installed"}'}));
  await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toContainText('not installed');
  await page.getByRole('button',{name:'Atomic Explorer',exact:true}).click();await expect(page.locator('#viewport canvas')).toBeVisible();
});
for(const width of [320,768,1024,1440])test(`advanced tools fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();await page.getByRole('button',{name:'MO reference diagrams',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'3D structures',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();await page.getByRole('button',{name:'Fields & Spin',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
