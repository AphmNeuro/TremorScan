import test from 'node:test';
import assert from 'node:assert/strict';
import {blueMarkers,amplitudeCm} from '../src/marker.js';
test('Blue disk detected; red disk rejected',()=>{
 const width=80,height=80,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const k=4*(y*width+x);data[k+3]=255;if(Math.hypot(x-40,y-40)<10){data[k]=20;data[k+1]=60;data[k+2]=220;}}
 const m=blueMarkers({data,width,height});assert.equal(m.length,1);assert.ok(Math.abs(m[0].diameter-20)<1);
 for(let k=0;k<data.length;k+=4)[data[k],data[k+2]]=[data[k+2],data[k]];
 assert.equal(blueMarkers({data,width,height}).length,0);
});
test('Joint fit recovers two peak-to-peak amplitudes with drift',()=>{
 const times=Array.from({length:600},(_,i)=>i/60),values=times.map(t=>30+2*t+10*Math.sin(2*Math.PI*3*t)+4*Math.cos(2*Math.PI*7*t));
 const frames=times.map(time=>({time,marker:{diameter:20}}));
 const r=amplitudeCm(frames,{result:{grid:{times,values}}},[3,7]);
 assert.ok(Math.abs(r[0].peakToPeak-1)<1e-8);assert.ok(Math.abs(r[1].peakToPeak-.4)<1e-8);
 assert.equal(amplitudeCm(frames.map(f=>({...f,marker:null})),{},[3]),null);
});
