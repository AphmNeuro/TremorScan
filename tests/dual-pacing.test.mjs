import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSignal, aggregate, analyzeTracks} from '../src/analysis.js';
import {PlaybackPacer, needsSlowerPass} from '../src/pacing.js';
import {resultCSV} from '../src/export.js';
import {VideoSession} from '../src/video.js';
const samples = fn => Array.from({length:1200},(_,i)=>({t:i/60,v:fn(i/60)}));
const sine = (f,t,a=4)=>a*Math.sin(2*Math.PI*f*t);
const signal = (fn,g,family='global') => ({group:g,point:g*4,axis:'x',family,result:analyzeSignal(samples(fn))});
const channels = (fn) => [0,1,2,3,4,5].map(g=>signal(fn,g));
test('Two simultaneous frequencies survive anatomical consensus',()=>{
  const cs = channels(t=>sine(5,t)+sine(8,t));
  const r=aggregate(cs);
  assert.equal(r.frequency,null);
  assert.equal(r.frequencies.length,2);
  assert.ok(Math.abs(r.frequencies[0]-5)<.2 && Math.abs(r.frequencies[1]-8)<.2);
  assert.deepEqual(aggregate(cs.reverse()).frequencies,r.frequencies);
});
test('A weaker real second peak is accepted',()=>{
  const r=aggregate(channels(t=>sine(5,t)+sine(8,t,2.8)));
  assert.equal(r.frequencies?.length,2);
});
test('A pure sinusoid is not split in two',()=>{
  const r=aggregate(channels(t=>sine(5,t)));
  assert.ok(Math.abs(r.frequency-5)<.2);
  assert.ok(!r.frequencies?.length);
});
test('Alternating frequencies are not reported as simultaneous',()=>{
  const r=aggregate(channels(t=>sine(t<10?5:8,t)));
  assert.ok(!r.frequencies?.length);
});
test('A double peak on one finger cannot create a dual result',()=>{
  const cs=channels(t=>sine(5,t));cs[5]=signal(t=>sine(5,t)+sine(8,t),5);
  assert.ok(!aggregate(cs).frequencies?.length);
});
test('Correlated axes cannot multiply anatomical votes',()=>{
  const r=aggregate(Array.from({length:20},()=>signal(t=>sine(5,t)+sine(8,t),1)));
  assert.ok(!r.frequencies?.length);
});
test('Harmonic relationship is acknowledged, not called two distinct tremors',()=>{
  const r=aggregate(channels(t=>sine(5,t)+sine(10,t)));
  assert.equal(r.frequencies?.length,2);assert.equal(r.harmonic,true);
});
test('Contradictory dual spectra between families remain uncertain',()=>{
  const cs=channels(t=>sine(5,t)+sine(8,t));
  cs.push(...[0,1,2,3,4,5].map(g=>signal(t=>sine(4,t)+sine(11,t),g,'relative')));
  assert.deepEqual(aggregate(cs).frequencies,[]);
});
test('Equally supported raw single frequency takes priority over relative double artefact',()=>{
  const cs=channels(t=>sine(5,t));
  cs.push(...[0,1,2,3,4,5].map(g=>signal(t=>sine(5,t)+sine(10,t,2.8),g,'relative')));
  const r=aggregate(cs);assert.ok(!r.frequencies?.length);assert.ok(Math.abs(r.frequency-5)<.2);
});
test('Synthetic tracked coordinates preserve both frequencies and export them',()=>{
  const frames=samples(t=>sine(5,t)+sine(8,t)).map(p=>({time:p.t,landmarks:Array.from({length:21},(_,i)=>({x:.3+i*.002+p.v/1000,y:.4+i*.003,z:0}))}));
  const r=analyzeTracks([{id:1,frames}],1000,500,[2,15],frames.length)[0];
  assert.equal(r.frequencies.length,2);
  const csv=resultCSV({results:[r],meta:{}});assert.match(csv,/frequency_2_hz/);assert.match(csv,/0.3.0/);
});
test('Pacing speeds up when processing keeps up and caps callback demand',()=>{
  const p=new PlaybackPacer();for(let i=0;i<100;i++){p.observeStep(1/60);p.completed(5);}
  assert.ok(p.rate>=.49 && p.rate<=.5);
  const old=p.rate;p.overload();assert.ok(p.rate<old);
  for(let i=0;i<100;i++)p.completed(1);
  assert.ok(p.rate<=.5 && p.rate>=old);
});
test('High frame rates reduce presentation speed; inference runs paused',()=>{
  const p=new PlaybackPacer();for(let i=0;i<100;i++){p.observeStep(1/120);p.completed(35);}
  assert.ok(p.rate<=.375 && p.rate>=.125);
});
test('More than two percent observed losses requests a conservative pass',()=>{
  assert.equal(needsSlowerPass({count:100,skipped:1,missedCallbacks:0}),false);
  assert.equal(needsSlowerPass({count:100,skipped:1,missedCallbacks:2}),true);
});
test('Two frequencies survive six percent dispersed missing samples',()=>{
  const cs=channels(t=>sine(5,t)+sine(8,t));
  for (const c of cs) c.result=analyzeSignal(samples(t=>sine(5,t)+sine(8,t)).filter((p,i)=>i%17!==0));
  const r=aggregate(cs);assert.equal(r.frequencies?.length,2);
  assert.ok(Math.abs(r.frequencies[0]-5)<.2 && Math.abs(r.frequencies[1]-8)<.2);
});
test('Acquisition automatically retries only once after observed loss', async()=>{
  const calls=[], progress=[];
  const session=new VideoSession({pause(){}},null,p=>progress.push(p.phase));
  session.runPass=async(band,adaptive)=>{ calls.push(adaptive);return {meta:{count:100,skipped:adaptive?10:0,missedCallbacks:0},results:[]}; };
  const r=await session.analyze([2,15]);
  assert.deepEqual(calls,[true,false]);assert.deepEqual(progress,['retry']);
  assert.equal(r.meta.retried,true);assert.equal(r.meta.samplingWarning,false);
});
test('Cancellation prevents an automatic retry', async()=>{
  const session=new VideoSession({pause(){}},null,()=>{});
  session.runPass=async()=>{ session.cancelled=true;return {meta:{count:100,skipped:10,missedCallbacks:0}}; };
  await assert.rejects(session.analyze([2,15]),/annulée/);
});
