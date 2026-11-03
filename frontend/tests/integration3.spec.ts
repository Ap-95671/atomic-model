import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const routes=[['Molecular Lab','Geometry optimization'],['Molecular Lab','Vibrational analysis'],['Computational Chemistry','Electron correlation'],['Computational Chemistry','Excited states'],['Computational Chemistry','Adaptive baseline'],['Quantum Dynamics','General superpositions'],['Quantum Dynamics','3D atomic evolution'],['Quantum Experiments','Decoherence'],['Quantum Experiments','Quantum computing'],['Quantum Materials','']];
for(const [lab,tool] of routes)test(`accessible new workflow ${tool||lab}`,async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:lab,exact:true}).click();if(tool)await page.getByRole('button',{name:tool,exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 const result=await new AxeBuilder({page}).include('#lab-workspace').withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(result.violations).toEqual([]);
});
test('adaptive baseline exposes measured evidence and abstains on held-out molecule',async({page})=>{
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await page.getByRole('button',{name:'Computational Chemistry',exact:true}).click();await page.getByRole('button',{name:'Adaptive baseline',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('.lab-results')).toContainText('Selected benchmark method');
 await page.locator('[name="case"]').selectOption('water');await page.getByRole('button',{name:'Calculate',exact:true}).click();await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');await expect(page.locator('.lab-results')).toContainText('Insufficient evidence · abstained');await expect(page.locator('.lab-results table')).toHaveCount(0);
});
