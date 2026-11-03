// Actual container/deployment UI evidence. Local captures do not prove public hosting.
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {chromium}=require('playwright');
const base=process.env.QAL_TEST_URL||'http://127.0.0.1:8767';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.goto(base);await page.locator('#loading').waitFor({state:'hidden'});
await page.locator('[data-family="3"]').click();await page.locator('#loading').waitFor({state:'hidden'});
await page.locator('#surface').click();await page.locator('#loading').waitFor({state:'hidden'});
await page.screenshot({path:new URL('../docs/railway-public-container-desktop.png',import.meta.url).pathname});
await page.setViewportSize({width:390,height:900});await page.getByRole('button',{name:'Molecular Lab',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('.lab-status')?.textContent==='Calculation complete.');
await page.screenshot({path:new URL('../docs/railway-public-container-mobile.png',import.meta.url).pathname});
const evidence={base_url:base,https_verified:new URL(base).protocol==='https:',mobile_document_width:await page.evaluate(()=>document.documentElement.scrollWidth),viewport_width:390,page_errors:errors,scope:'Actual public-mode browser screenshots; localhost is container verification, not Railway deployment.'};
await writeFile(new URL('../docs/RAILWAY_BROWSER_VERIFICATION.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));await browser.close();
