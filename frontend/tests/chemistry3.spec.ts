import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/');await expect(page.locator('#loading')).toBeHidden();});
test('Molecular Lab selects computed O2 and every spin orbital without another SCF',async({page})=>{
  await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();
  await expect(page.locator('[name="system"] option[value="o2"]')).toHaveCount(1);
  await page.locator('[name="system"]').selectOption('o2');
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.',{timeout:30_000});
  await expect(page.locator('.result-metrics')).toContainText('9.000 / 7.000');
  await expect(page.locator('.result-heading')).toContainText('UHF');
  await expect(page.locator('[name="orbital"] option')).toHaveCount(11);
  let submitted:string[]=[];page.on('request',r=>{if(r.url().endsWith('/api/jobs')&&r.method()==='POST')submitted.push(JSON.parse(r.postData()!).operation);});
  await page.locator('[name="orbital"]').selectOption('0');
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await expect(page.locator('[data-field-title]')).toHaveText('alpha orbital 1');
  await page.locator('[name="channel"]').selectOption('beta');
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await expect(page.locator('[data-field-title]')).toHaveText('beta orbital 1');
  expect(submitted).toEqual(['field','field']);
  const file=page.waitForEvent('download');await page.getByRole('button',{name:'Export all orbitals CSV'}).click();expect(await(await file).failure()).toBeNull();
});
test('optimized H2+ exponent and grid remain genuine calculated fields',async({page})=>{
  await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await page.locator('[name="optimize"]').selectOption('true');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await expect(page.locator('.lab-results')).toContainText('ζ=1.238697');
  await expect(page.locator('.result-metrics')).toContainText('-0.586506');
});
test('measurement batches accumulate and reset without generating another batch',async({page})=>{
  await page.getByRole('button',{name:'Quantum Experiments',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('2,000');
  await page.getByRole('button',{name:'Add independent batch',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toContainText('4,000');
  await expect(page.locator('.result-heading p')).toContainText('2 batches');
  let calls=0;page.on('request',r=>{if(r.url().includes('/api/measurement?'))calls++;});
  await page.getByRole('button',{name:'Reset measurements',exact:true}).click();
  await expect(page.locator('.result-heading h2')).toHaveText('0 independent measurements');
  await expect(page.locator('.lab-results')).toContainText('no measurements');expect(calls).toBe(0);
});
test('actual job cancellation terminates the worker and keeps inputs usable',async({page})=>{
  await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();
  await page.getByRole('button',{name:'Spin-aware / all orbitals',exact:true}).click();
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
  await page.locator('[name="system"]').selectOption('benzene');await page.locator('[name="basis"]').selectOption('cc-pvdz');await page.locator('[name="method"]').selectOption('b3lyp');
  let jobId='';page.on('response',async r=>{if(r.url().endsWith('/api/jobs')&&r.request().method()==='POST')jobId=(await r.json()).id;});
  await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect.poll(()=>jobId).not.toBe('');
  await page.getByRole('button',{name:'Cancel calculation',exact:true}).click();await expect(page.locator('.lab-status')).toContainText('cancelled');
  await expect.poll(async()=>{const r=await page.request.get(`/api/jobs/${jobId}`);return(await r.json()).status;}).toBe('cancelled');
  await page.getByRole('button',{name:'Defaults',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
});
test('failed atomic parameters explicitly label the retained state',async({page})=>{
  await page.route('**/api/orbital?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Capacity test"}'}));
  await page.locator('[data-family="1"]').click();
  await expect(page.locator('#atomic-result-status')).toContainText('Requested result failed');
  await expect(page.locator('#atomic-result-status')).toContainText('1s');await expect(page.locator('#export')).toBeDisabled();
});
for(const width of [320,768,1440])test(`computed molecules fit ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();
  if(width<=760)await page.getByText('Experiment parameters',{exact:true}).click();
  await expect(page.locator('[name="system"] option[value="n2"]')).toHaveCount(1);await page.locator('[name="system"]').selectOption('n2');
  await expect(page.locator('.lab-status')).toHaveText('Calculation complete.',{timeout:30_000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});
