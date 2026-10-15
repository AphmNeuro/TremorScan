import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base='https://aphmneuro.github.io/TremorScan/';
const before=JSON.parse(await readFile(new URL('./artifacts/stable-before.json',import.meta.url),'utf8'));
for(const [path,hash] of Object.entries(before)){
  const r=await fetch(base+path,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok,path);
  const body=await r.text();
  if(path==='index.html'){
    assert.ok(!body.includes('class="privacy"'));assert.ok(!body.includes('Une fréquence à explorer'));
    assert.ok(!body.includes('href="./docs/methodologie.html"'));assert.ok(!body.includes('id="mode-face"'));
    assert.match(body,/v0.3/);
  }else assert.equal(createHash('sha256').update(body).digest('hex'),hash,'Stable file changed: '+path);
}
console.log('PASS stable release: requested HTML changes only; all seven other sampled files byte-identical');
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.screenshot({path:fileURLToPath(new URL('./artifacts/stable-live.png',import.meta.url)),fullPage:true});
  assert.ok(await page.locator('.brand').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=20));
  assert.equal(await page.locator('#mode-face').count(),0);
  await page.goto(base+'visage/');
  await page.locator('#mode-face').click();
  assert.equal(await page.locator('.privacy').count(),0);
  assert.equal(await page.locator('a[href="./docs/methodologie.html"]').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.ok(await page.locator('.brand').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=20));
  await page.screenshot({path:fileURLToPath(new URL('./artifacts/preview-live.png',import.meta.url)),fullPage:true});
  await page.screenshot({path:fileURLToPath(new URL('./artifacts/preview-live-compact.png',import.meta.url))});
  if(!process.argv.includes('--layout-only')){
  const blink=process.argv.includes('--blink');
  assert.match(await page.locator('body').innerText(),/v0\.4\.1/);
  await page.locator('#video-file').setInputFiles(fileURLToPath(new URL(blink?'./artifacts/face-blink-1hz.webm':'./artifacts/face-reference.webm',import.meta.url)));
  await page.locator('#analyze').click();await page.locator('#results').waitFor({state:'visible',timeout:180000});
  assert.match(await page.locator('#results').innerText(),blink?/MOUVEMENT FACIAL PARTAGÉ/i:/MOUVEMENT GLOBAL/);
  assert.equal(await page.locator('.result-card').count(),1);
  assert.ok(Math.abs(parseFloat(await page.locator('.frequency').innerText())-(blink?1:5))<.2);
  await page.locator('#results').screenshot({path:fileURLToPath(new URL('./artifacts/preview-live-result.png',import.meta.url))});
  assert.deepEqual(errors,[]);
  await writeFile(new URL('./artifacts/deployed-preview.json',import.meta.url),JSON.stringify({stableAnalysisUnchanged:true,testFrequency:blink?1:5,errors},null,2));
  console.log('PASS public parallel preview: face model, video analysis, '+(blink?1:5)+' Hz, single result, mobile layout');
  }else console.log('PASS final published HTML and brand styling on both versions');
}finally{await browser.close();}
