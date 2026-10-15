import test from 'node:test';
import assert from 'node:assert/strict';
import {FACE_IDS,REGIONS,faceSignals,stabilizedFrames} from '../src/face.js';
import {analyzeFaceTracks,analyzeSignal} from '../src/analysis.js';
const base=FACE_IDS.map((id,i)=>({x:.3+(i%9)*.04,y:.25+Math.floor(i/9)*.025,z:0}));
base[0]={x:.3,y:.4,z:0};base[1]={x:.7,y:.4,z:0};base[2]={x:.5,y:.42,z:0};base[3]={x:.5,y:.46,z:0};
function frames(fn,n=1200){return Array.from({length:n},(_,i)=>({time:i/60,landmarks:base.map((p,j)=>fn({...p},FACE_IDS[j],i/60))}));}
const analyse=f=>analyzeFaceTracks([{id:1,frames:f}],640,480,[.5,15],f.length);
const region=REGIONS.find(r=>r.key==='right-eye');
for(const hz of [.5,.6,1,1.5,3])test('Signed eyelid openings recover '+hz+' Hz, without frequency doubling',()=>{
  const upper=region.gaps.map(g=>g[0]),lower=region.gaps.map(g=>g[1]);
  const f=frames((p,id,t)=>({...p,y:p.y+(upper.includes(id)?-1:lower.includes(id)?1:0)*.01*Math.sin(2*Math.PI*hz*t)}));
  const r=analyse(f).find(r=>r.region===region.key);
  assert.ok(r.frequencies.some(v=>Math.abs(v-hz)<.2),JSON.stringify(r.frequencies));
  const gap=faceSignals(stabilizedFrames(f,640,480),region).find(c=>c.axis==='gap-y');
  assert.ok(Math.abs(analyzeSignal(gap.samples,[.5,15],{slow:true}).peak.frequency-hz)<.2);
});
test('Two moving eyebrow subregions suffice with an explicit possible label',()=>{
  const rgn=REGIONS.find(r=>r.key==='right-brow'),ids=rgn.groups.slice(0,2).flat();
  const r=analyse(frames((p,id,t)=>({...p,y:p.y+(ids.includes(id)?.01*Math.sin(2*Math.PI*t):0)}))).find(r=>r.region===rgn.key);
  assert.ok(Math.abs(r.frequency-1)<.2);assert.equal(r.reliability,'Périodicité possible');assert.equal(r.groups,2);
});
test('A sizeable local movement synchronous with the head is retained cautiously',()=>{
  const ids=region.groups.flat();const rs=analyse(frames((p,id,t)=>({...p,x:p.x+.01*Math.sin(2*Math.PI*t),y:p.y+(ids.includes(id)?.01*Math.sin(2*Math.PI*t):0)})));
  const r=rs.find(r=>r.region===region.key);assert.ok(Math.abs(r.frequency-1)<.2);assert.equal(r.reliability,'Périodicité possible');assert.match(r.reason,/indépendance/);
});
test('A single blink or monotonic drift is not promoted to a slow frequency',()=>{
  const ids=region.groups.flat();
  for(const movement of [t=>.02*Math.exp(-(((t-10)/.12)**2)),t=>.002*t]){
    const r=analyse(frames((p,id,t)=>({...p,y:p.y+(ids.includes(id)?movement(t):0)}))).find(r=>r.region===region.key);
    assert.equal(r.frequencies.length,0);
  }
});
test('Independent white noise is not promoted to facial periodicity (10 seeded trials)',()=>{
  for(let trial=1;trial<=10;trial++){
    let state=trial;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296-.5;};
    const ids=region.groups.flat();
    const rs=analyse(frames((p,id)=>({...p,y:p.y+(ids.includes(id)?random()*.006:0)}),720));
    assert.ok(rs.every(r=>!r.frequencies.length),'noise trial '+trial);
  }
});
test('A slower out-of-band oscillation is not replaced by a spectral sidelobe',()=>{
  const ids=region.groups.flat();
  const rs=analyse(frames((p,id,t)=>({...p,y:p.y+(ids.includes(id)?.01*Math.sin(2*Math.PI*.3*t):0)})));
  assert.ok(rs.every(r=>!r.frequencies.length));
});
test('A shared mesh oscillation is reported once with uncertain localization',()=>{
  const ids=REGIONS.filter(r=>['upper-lip','lower-lip','right-eye','left-eye','chin'].includes(r.key)).flatMap(r=>r.groups.flat());
  const rs=analyse(frames((p,id,t)=>({...p,y:p.y+(ids.includes(id)?.01*Math.sin(2*Math.PI*t):0)})));
  const reported=rs.filter(r=>r.frequencies.length);
  assert.equal(reported.length,1);assert.match(reported[0].region,/shared-face/);
  assert.equal(reported[0].reliability,'Localisation incertaine');assert.ok(Math.abs(reported[0].frequency-1)<.2);
});
