import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function atomic(page:import('@playwright/test').Page){
 await page.goto('/#lab=atomic');await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#orbital-title')).toHaveText('1s');
}
async function choose(page:import('@playwright/test').Page,z:number){
 await page.locator('#open-table').click();await page.locator(`[data-z="${z}"]`).click();await expect(page.locator('#atomic-z')).toHaveText(String(z));await expect(page.locator('#loading')).toBeHidden();
}
test('homepage reuses the live viewport and enters a default ground-state workspace',async({page})=>{
 await page.goto('/');await expect(page.locator('#loading')).toBeHidden();
 await expect(page.locator('#home-workspace')).toBeVisible();await expect(page.locator('#home-scene canvas')).toBeVisible();
 const canvas=await page.locator('#viewport canvas').elementHandle();
 await page.getByRole('link',{name:'Enter the laboratory'}).click();await expect(page.locator('#atomic-workspace')).toBeVisible();
 expect(await page.locator('#viewport canvas').evaluate((el,old)=>el===old,canvas)).toBe(true);
 await expect(page.locator('#orbital-scope')).toHaveValue('ground');await expect(page.locator('#occupied-picker button')).toHaveText('1s1');
 await expect(page.locator('[data-family="1"]')).toBeHidden();await expect(page.locator('#n option:enabled')).toHaveCount(1);
});
test('hydrogen exploration is explicit and never claims an excitation',async({page})=>{
 await atomic(page);await page.locator('#orbital-scope').selectOption('explore');await page.locator('[data-family="2"]').click();
 await expect(page.locator('#orbital-title')).toContainText('3d');await expect(page.locator('#occupancy-note')).toContainText('Unoccupied');await expect(page.locator('#occupancy-note')).toContainText('does not excite');
 await page.reload();await expect(page.locator('#orbital-scope')).toHaveValue('explore');await expect(page.locator('#orbital-title')).toContainText('3d');
 await page.locator('#orbital-scope').selectOption('ground');await expect(page.locator('#orbital-title')).toHaveText('1s');
 await expect(page.locator('#spin option:enabled')).toHaveCount(1);
});
test('helium, carbon and reference exceptions expose only occupied subshells',async({page})=>{
 await atomic(page);
 for(const [z,configuration] of [[2,'1s2'],[6,'1s2 2s2 2p2'],[11,'3s1'],[24,'3d5 4s1'],[26,'3d6 4s2'],[29,'3d10 4s1'],[46,'4d10'],[58,'4f1 5d1 6s2']] as const){
  await choose(page,z);for(const subshell of configuration.split(' '))await expect(page.locator('.configuration')).toContainText(subshell);
  const reference=await(await page.request.get(`/api/species?z=${z}`)).json();
  const occupied=reference.electronic.occupancy.filter((s:{electrons:number})=>s.electrons>0);
  await expect(page.locator('#occupied-picker button')).toHaveCount(occupied.length);
  if(z===6){await page.locator('[data-ground="2,1"]').click();await expect(page.locator('#orbital-shortcuts button')).toHaveCount(2);await expect(page.locator('#orientation option:enabled')).toHaveCount(2);await expect(page.locator('#occupancy-note')).toContainText('1 electron(s)');}
  if(z===46)await expect(page.locator('[data-ground="5,0"]')).toHaveCount(0);
 }
 await choose(page,118);await expect(page.locator('.config-status')).toContainText(/predicted|unverified/i);
});
test('bare ions show an explanation instead of a fictitious occupied density',async({page})=>{
 await atomic(page);await page.locator('#charge').fill('1');await page.locator('#charge').press('Tab');
 await expect(page.locator('#orbital-title')).toHaveText('No occupied state');await expect(page.locator('#atomic-result-status')).toContainText('Bare nucleus');await expect(page.locator('#export')).toBeDisabled();
 await page.locator('#orbital-scope').selectOption('explore');await expect(page.locator('#orbital-title')).toHaveText('1s');await expect(page.locator('#occupancy-note')).toContainText('Unoccupied');
});
test('command search is keyboard accessible and opens an element ground state',async({page})=>{
 await page.goto('/');await expect(page.locator('#loading')).toBeHidden();await page.keyboard.press('Control+k');
 await expect(page.locator('#command-input')).toBeFocused();await page.locator('#command-input').fill('carbon');await page.keyboard.press('Enter');
 await expect(page.locator('#element-name')).toHaveText('Carbon');await expect(page.locator('#orbital-scope')).toHaveValue('ground');
 await page.locator('#command-search').click();await page.locator('#command-input').fill('not-a-match');await expect(page.locator('#command-status')).toContainText('No matches');await page.keyboard.press('Escape');await expect(page.locator('#command-search')).toBeFocused();
});
test('atomic display settings and a saved preset survive route changes and refresh',async({page})=>{
 await atomic(page);await choose(page,6);await page.locator('[data-ground="2,1"]').click();await expect(page.locator('#loading')).toBeHidden();
 await page.locator('#axes').uncheck();await page.locator('#opacity').fill('0.75');await page.locator('#camera-preset').selectOption('z');
 await page.locator('#experiment-presets').click();await page.locator('#preset-form input').fill('Carbon p state');await page.locator('#preset-form button').click();await expect(page.locator('#preset-status')).toContainText('saved');
 await page.keyboard.press('Escape');await choose(page,1);
 await page.locator('#experiment-presets').click();await page.getByRole('link',{name:'Carbon p state',exact:true}).click();
 await expect(page.locator('#element-name')).toHaveText('Carbon');await expect(page.locator('#orbital-title')).toContainText('2p');await expect(page.locator('#axes')).not.toBeChecked();await expect(page.locator('#opacity')).toHaveValue('0.75');await expect(page.locator('#camera-preset')).toHaveValue('z');
 await page.reload();await expect(page.locator('#loading')).toBeHidden();await expect(page.locator('#orbital-title')).toContainText('2p');await expect(page.locator('#axes')).not.toBeChecked();await expect(page.locator('#opacity')).toHaveValue('0.75');
});
test('presentation mode supports exit with Escape',async({page})=>{
 await atomic(page);await page.locator('#presentation').click();await expect(page.locator('body')).toHaveClass(/presenting/);
 await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass(/presenting/);await expect(page.locator('#presentation')).toBeFocused();
});
test('timeline comparison restores both model selections on refresh',async({page})=>{
 await page.goto('/#lab=history&model=thomson&compare=quantum');await expect(page.locator('.history-card h2')).toHaveText(['Thomson','Quantum mechanics']);
 await page.locator('[data-model="rutherford"]').click();await page.locator('#history-second').selectOption('bohr');await page.reload();await expect(page.locator('.history-card h2')).toHaveText(['Rutherford','Bohr']);
});
for(const theme of ['light','dark'])for(const route of ['home','atomic','history','molecular','spectroscopy'])test(`${theme} theme accessible in ${route}`,async({page})=>{
 await page.addInitScript(value=>localStorage.setItem('qal-theme',value),theme);
 await page.goto('/#lab='+route);await expect(page.locator('body')).toHaveAttribute('data-page',route);
 if(route==='home'||route==='atomic')await expect(page.locator('#loading')).toBeHidden();else if(route==='history')await expect(page.locator('.history-card')).toHaveCount(2);else await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
for(const width of [320,390,768,1440])test(`new layouts fit ${width}px and preserve accessible controls`,async({page})=>{
 await page.setViewportSize({width,height:900});
 for(const route of ['home','atomic','history']){
  await page.goto('/#lab='+route);await expect(page.locator('body')).toHaveAttribute('data-page',route);
  if(route!=='history')await expect(page.locator('#loading')).toBeHidden();else await expect(page.locator('.history-card')).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 }
});
test('theme preference survives reload and denied storage does not prevent startup',async({page})=>{
 await atomic(page);const prior=await page.locator('html').getAttribute('data-theme');await page.locator('#theme-toggle').click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme',prior==='light'?'dark':'light');
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage denied');};Storage.prototype.getItem=()=>{throw new Error('Storage denied');};});
 await page.reload();await expect(page.locator('#orbital-title')).toHaveText('1s');await expect(page.locator('#loading')).toBeHidden();
});
test('mobile controls open as a native disclosure and allow real element changes',async({page})=>{
 await page.setViewportSize({width:390,height:844});await atomic(page);
 await expect(page.locator('#open-table')).toBeHidden();await page.getByText('Atom & orbital controls',{exact:true}).click();await choose(page,6);
 await expect(page.locator('#occupied-picker button')).toHaveCount(3);
});
test('command results announce keyboard selection and open a specific experiment',async({page})=>{
 await atomic(page);await page.locator('#command-search').click();await page.locator('#command-input').fill('circuits');
 await expect(page.locator('#command-input')).toHaveAttribute('aria-activedescendant','command-result-0');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(audit.violations).toEqual([]);
 await page.keyboard.press('Enter');await expect(page.locator('#lab-workspace h1')).toHaveText(/Quantum Circuit/);await expect(page.locator('.lab-status')).toHaveText('Calculation complete.');
});
test('unsafe stored preset links are discarded',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('qal-experiments-v1',JSON.stringify([{name:'Bad',hash:'javascript:alert(1)&lab=atomic'}])));
 await atomic(page);await page.locator('#experiment-presets').click();await expect(page.locator('.preset-list')).toContainText('No saved experiments');await expect(page.locator('.preset-list a')).toHaveCount(0);
});
test('orbital errors expose an explicit working retry',async({page})=>{
 await atomic(page);await page.locator('#orbital-scope').selectOption('explore');await expect(page.locator('#loading')).toBeHidden();
 await page.route('**/api/orbital?**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"temporary unavailable test"}'}));
 await page.locator('[data-family="1"]').click();await expect(page.locator('#retry-orbital')).toBeVisible();await page.unroute('**/api/orbital?**');await page.locator('#retry-orbital').click();await expect(page.locator('#orbital-title')).toHaveText('2p_z');await expect(page.locator('#retry-orbital')).toBeHidden();
});
