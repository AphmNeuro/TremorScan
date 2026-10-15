// Synthetic eyelid deformation of a public portrait, NOT a clinical video.
import {pathToFileURL,fileURLToPath} from 'node:url';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  await page.addInitScript(()=>{const OriginalWorker=window.Worker;window.Worker=class extends OriginalWorker{constructor(...args){super(...args);this.addEventListener('message',({data})=>{if(data.type==='results')window.testResults=data.results;});}};});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:4181/dist/');
  if(!process.argv.includes('--reuse')){
  const bytes=await page.evaluate(async()=>{
    const {FACE_IDS}=await import('./src/face.js');
    const im=new Image();im.src='../tests/assets/face-reference.jpg';await im.decode();
    const source=document.createElement('canvas');source.width=640;source.height=640;
    source.getContext('2d').drawImage(im,0,0,640,640);
    const worker=new Worker('./src/worker-bootstrap.js');
    const points=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{worker.terminate();reject(Error('Reference detection timeout'));},60000);
      worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(Error(e.message));};
      worker.onmessage=async({data})=>{
        if(data.type==='ready'){const bitmap=await createImageBitmap(source);worker.postMessage({type:'frame',bitmap,time:0},[bitmap]);}
        if(data.type==='frame'){clearTimeout(timeout);worker.terminate();resolve(data.hands[0]);}
        if(data.type==='error'){clearTimeout(timeout);worker.terminate();reject(Error(data.message));}
      };worker.postMessage({type:'init',mode:'face'});
    });
    if(!points)throw Error('Reference face missing');
    const boxes=[[161,159,157,163,145,154],[384,386,388,381,374,390]].map(ids=>{
      const ps=ids.map(id=>points[FACE_IDS.indexOf(id)]),xs=ps.map(p=>p.x*640),ys=ps.map(p=>p.y*640);
      const x=Math.min(...xs)-8,y=Math.min(...ys)-2,w=Math.max(...xs)-x+8,h=Math.max(...ys)-y+2;
      return {x,y,w,h,margin:Math.max(15,h)};
    });
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const ctx=canvas.getContext('2d'),chunks=[],stream=canvas.captureStream(30);
    const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
    const done=new Promise(r=>recorder.onstop=r);recorder.ondataavailable=e=>chunks.push(e.data);
    const start=performance.now();
    const draw=()=>{
      const t=(performance.now()-start)/1000,amount=.85*(.5-.5*Math.cos(2*Math.PI*t));
      ctx.drawImage(source,0,0);
      for(const {x,y,w,h,margin:m} of boxes){
        const top=y+amount*h/2,opening=h*(1-amount);
        ctx.drawImage(source,x,y-m,w,m,x,y-m,w,top-(y-m));
        ctx.drawImage(source,x,y,w,h,x,top,w,opening);
        ctx.drawImage(source,x,y+h,w,m,x,top+opening,w,y+h+m-top-opening);
      }
    };
    draw();recorder.start();const timer=setInterval(draw,1000/30);
    await new Promise(r=>setTimeout(r,12000));clearInterval(timer);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  await writeFile(new URL('./artifacts/face-blink-1hz.webm',import.meta.url),new Uint8Array(bytes));
  }
  const path=fileURLToPath(new URL('./artifacts/face-blink-1hz.webm',import.meta.url));
  await page.locator('#mode-face').click();assert.equal(await page.locator('#low').inputValue(),'0.5');
  await page.locator('#video-file').setInputFiles(path);await page.locator('#analyze').click();
  await page.locator('#results').waitFor({state:'visible',timeout:180000});
  const output=await page.locator('#results').innerText();
  console.log(await page.evaluate(()=>window.testResults.map(r=>({region:r.region,hz:r.frequencies,rms:r.representative?.result.rms,measure:r.representative?.measurement}))));
  const cards=page.locator('.result-card').filter({hasText:/PAUPIÈRES|MOUVEMENT FACIAL PARTAGÉ/});assert.ok(await cards.count()>0,'Eyelid or shared facial periodicity expected');
  const frequencies=await cards.locator('.frequency').allTextContents();assert.ok(frequencies.some(s=>Math.abs(parseFloat(s)-1)<.2),JSON.stringify(frequencies));
  const shared=await page.locator('.result-card').filter({hasText:/MOUVEMENT FACIAL PARTAGÉ/}).count();
  if(shared)assert.equal(await page.locator('.result-card').count(),1,'Do not label correlated mesh responses as independent local findings');
  assert.deepEqual(errors,[]);
  await page.locator('#results').screenshot({path:fileURLToPath(new URL('./artifacts/face-blink-result.png',import.meta.url))});
  await writeFile(new URL('./artifacts/face-blink-result.txt',import.meta.url),output);
  console.log('PASS local synthetic eyelid video: 1 Hz detected, default slow band, no browser errors');
}finally{await browser.close();}
