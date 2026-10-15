// End-to-end detector smoke test on public MediaPipe reference video.
// This is NOT a local facial movement or clinical validation.
import {pathToFileURL,fileURLToPath} from 'node:url';
import {writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
  const errors=[],external=[];let faceRequests=0,handRequests=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{const u=r.url();if(u.endsWith('/face_landmarker.task'))faceRequests++;if(u.endsWith('/hand_landmarker.task'))handRequests++;if(/^https?:/.test(u)&&new URL(u).origin!==new URL(process.env.TEST_URL || 'http://127.0.0.1:4180/').origin)external.push(u);});
  await page.goto((process.env.TEST_URL || 'http://127.0.0.1:4180/dist/'));
  const bytes=await page.evaluate(async()=>{
    const im=new Image();im.src='../tests/assets/face-reference.jpg';await im.decode();
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),chunks=[];
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
    const done=new Promise(resolve=>recorder.onstop=resolve);recorder.ondataavailable=e=>chunks.push(e.data);
    const start=performance.now();
    const draw=()=>{const t=(performance.now()-start)/1000;ctx.fillStyle='#ddd';ctx.fillRect(0,0,640,640);ctx.drawImage(im,110+10*Math.sin(2*Math.PI*5*t),30,420,560);};
    draw();recorder.start();const timer=setInterval(draw,1000/30);
    await new Promise(r=>setTimeout(r,10000));clearInterval(timer);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await writeFile(new URL('./artifacts/face-reference.webm',import.meta.url),new Uint8Array(bytes));
  await page.locator('#mode-face').click();
  assert.match(await page.locator('#start-title').innerText(),/visage/);
  await page.screenshot({path:fileURLToPath(new URL('./artifacts/face-home.png',import.meta.url)),fullPage:true});
  await page.locator('#video-file').setInputFiles(fileURLToPath(new URL('./artifacts/face-reference.webm',import.meta.url)));
  await page.locator('#analyze').click();
  assert.equal(await page.locator('#mode-hand').isEnabled(),false);
  await page.locator('#results').waitFor({state:'visible',timeout:180000});
  const result=await page.locator('#results').innerText();console.log(result);
  assert.equal(await page.locator('.result-card').count(),1,'Rigid portrait motion must not become independent local periodicities');
  assert.match(await page.locator('.result-card .eyebrow').innerText(),/GLOBAL/);
  const hz=parseFloat(await page.locator('.frequency').innerText());assert.ok(Math.abs(hz-5)<0.2);
  const download=page.waitForEvent('download');await page.locator('#export-data').click();
  const coordinates=await readFile(await(await download).path(),'utf8');
  assert.match(coordinates,/face_id/);assert.ok(coordinates.split('\n').length>1000,'Actual detector coordinates expected');
  assert.equal(faceRequests,1);assert.equal(handRequests,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#results').screenshot({path:fileURLToPath(new URL('./artifacts/face-result.png',import.meta.url))});
  await page.locator('#analyze').click();await page.locator('#results').waitFor({state:'visible',timeout:30000});
  assert.equal(faceRequests,1);assert.match(await page.locator('#sampling').textContent(),/réutilisées/);
  await page.locator('#mode-hand').click();
  assert.equal(await page.locator('#results').isVisible(),false);assert.equal(await page.locator('#workspace').isVisible(),false);
  assert.match(await page.locator('#start-title').innerText(),/main/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await writeFile(new URL('./artifacts/face-ui.json',import.meta.url),JSON.stringify({result,coordinateRows:coordinates.split('\n').length,faceRequests,handRequests,errors,external},null,2));
  console.log('PASS face detector, export, cached recomputation, mode reset, mobile layout, local-only requests');
}finally{await browser.close();}
