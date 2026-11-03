import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const mode of ['Atomic Explorer','Molecular Lab','Spectroscopy','Quantum Dynamics','Quantum Experiments','Computational Chemistry'])test(`accessible ${mode}`,async({page})=>{
  await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();
  if(mode!=='Atomic Explorer'){await page.getByRole('button',{name:mode,exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');}
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(results.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('guide activity operates the actual nodal model and modal is named',async({page})=>{
  await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'Scientific Guide',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'A guide to the quantum model'})).toBeVisible();
  await page.getByRole('button',{name:'Observe a 2p nodal plane',exact:true}).click();
  await expect(page.locator('#orbital-title')).toHaveText('2p_z');await expect(page.locator('#nodes')).toBeChecked();
  await expect(page.locator('#viewport-caption')).toContainText('73³');
});
