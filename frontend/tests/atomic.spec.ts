import { test, expect } from '@playwright/test';
test.beforeEach(async ({page}) => {
  await page.goto('/#lab=atomic');
  await expect(page.locator('#loading')).toBeHidden();await page.locator('#orbital-scope').selectOption('explore');await expect(page.locator('#loading')).toBeHidden();
});
for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`atomic layout fits ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('#viewport canvas')).toBeVisible();
  });
}
test('orbital families, nodes, complex phase and rendering controls', async ({page}) => {
  await page.locator('[data-family="1"]').click();
  await expect(page.locator('#orbital-title')).toHaveText('2p_z');
  await page.locator('#nodes').check();
  await page.locator('#surface').click();
  await expect(page.locator('#viewport-caption')).toContainText('49³');
  await page.locator('#quality').selectOption('balanced');
  await expect(page.locator('#viewport-caption')).toContainText('73³');
  await page.locator('[data-family="3"]').click();
  await expect(page.locator('#orbital-title')).toHaveText('4f_z³');
  await page.locator('#basis').selectOption('complex');
  await expect(page.locator('#legend')).toContainText('arg(ψ)');
  await page.locator('#density').click();
  await expect(page.locator('#legend')).toContainText('|ψ|²');
  await page.locator('#reset').click();
});
test('periodic search, ions and modal focus return', async ({page}) => {
  await page.locator('#open-table').click();
  await page.locator('#element-search').fill('iron');
  await page.locator('[data-z="26"]').click();
  await expect(page.locator('#element-name')).toHaveText('Iron');
  await page.locator('#charge').fill('2');
  await page.locator('#charge').press('Tab');
  await expect(page.locator('#e-count')).toHaveText('24');
  await page.locator('#help').click();
  await expect(page.locator('#dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#dialog')).toBeHidden();
  await expect(page.locator('#help')).toBeFocused();
});
test('analysis tabs implement arrow-key navigation', async ({page}) => {
  await page.getByRole('tab', {name:'Electron configuration'}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Radial probability'})).toBeFocused();
  await expect(page.locator('#analysis-content svg')).toBeVisible();
});
test('error feedback and recovery preserve atomic state', async ({page}) => {
  await page.route('**/api/orbital?**', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test geometry capacity reached'})}));
  await page.locator('[data-family="1"]').click();
  await expect(page.locator('#toast')).toContainText('capacity reached');
  await expect(page.locator('#loading')).toBeHidden();
  await page.unroute('**/api/orbital?**');
  await page.locator('[data-family="2"]').click();
  await expect(page.locator('#orbital-title')).toHaveText('3d_z²');
});
test('viewport PNG export completes', async ({page}) => {
  const downloaded=page.waitForEvent('download');
  await page.locator('#export').click();
  const file=await downloaded;
  expect(file.suggestedFilename()).toMatch(/quantum-.*\.png/);
  expect(await file.failure()).toBeNull();
});
test('textual science remains available when WebGL initialization fails', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind: string, ...args: unknown[]) {
      if (kind.startsWith('webgl')) return null;
      return original.call(this, kind, ...args);
    } as typeof original;
  });
  await page.reload();
  await expect(page.locator('#normalization')).toContainText('1.000000');
  await expect(page.locator('#element-name')).toHaveText('Hydrogen');
  await expect(page.locator('#toast')).toContainText('WebGL could not initialize');
});
test('idle rendering stops and repeated cloud/color changes release GPU buffers',async({page})=>{
  await page.addInitScript(()=>{
    const stats={draws:0,buffers:new Set<WebGLBuffer>()};
    (window as unknown as {gpuStats:typeof stats}).gpuStats=stats;
    const prototype=WebGL2RenderingContext.prototype;
    const create=prototype.createBuffer,remove=prototype.deleteBuffer,draw=prototype.drawArrays;
    prototype.createBuffer=function(){const buffer=create.call(this);if(buffer)stats.buffers.add(buffer);return buffer;};
    prototype.deleteBuffer=function(buffer){if(buffer)stats.buffers.delete(buffer);return remove.call(this,buffer);};
    prototype.drawArrays=function(...args){stats.draws++;return draw.apply(this,args);};
  });
  await page.reload();await expect(page.locator('#loading')).toBeHidden();
  const sample=()=>page.evaluate(()=>{const s=(window as unknown as {gpuStats:{draws:number;buffers:Set<WebGLBuffer>}}).gpuStats;return {draws:s.draws,buffers:s.buffers.size};});
  // Wait for the initial WebGL draw, then sample a genuinely idle window.
  await expect.poll(async()=>(await sample()).draws).toBeGreaterThan(0);
  let before=await sample();
  // Initial resize/font/intersection events may legitimately schedule another
  // frame. Require a settled 300 ms window, rather than the first visible draw.
  await expect(async()=>{
    before=await sample();await page.waitForTimeout(300);
    expect((await sample()).draws).toBe(before.draws);
  }).toPass({timeout:5000});
  for(let i=0;i<5;i++){
    await page.locator('[data-family="1"]').click();await expect(page.locator('#orbital-title')).toHaveText('2p_z');
    await page.locator('#density').click();await page.locator('#phase').click();
    await page.locator('[data-family="0"]').click();await expect(page.locator('#orbital-title')).toHaveText('2s');
    await page.locator('#n').selectOption('1');await expect(page.locator('#orbital-title')).toHaveText('1s');
  }
  await expect.poll(async()=>(await sample()).buffers).toBeLessThanOrEqual(before.buffers+2);
});
test('subshell overlays preserve visibility and a common physical scale',async({page})=>{
  await page.locator('[data-family="2"]').click();await expect(page.locator('#orbital-title')).toHaveText('3d_z²');
  await page.locator('#overlay').selectOption('subshell');
  await expect(page.locator('#viewport-caption')).toContainText('Overlay of individually normalized');
  await expect(page.locator('#scale-readout')).toContainText('Common scale');
  const layers=page.locator('[data-overlay-state]');await expect(layers).toHaveCount(5);
  for(const layer of await layers.all()){await layer.uncheck();await expect(page.locator('#loading')).toBeHidden();}
  await expect(page.locator('#viewport-caption')).toContainText('No orbital layers selected');
  await layers.first().check();await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#viewport-caption')).toContainText('Overlay of individually normalized');
});
