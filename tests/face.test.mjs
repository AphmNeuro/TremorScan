import test from 'node:test';
import assert from 'node:assert/strict';
import {FACE_IDS,REGIONS,FaceTracker} from '../src/face.js';
import {analyzeFaceTracks} from '../src/analysis.js';
import {resultCSV,timeCSV} from '../src/export.js';
const base=FACE_IDS.map((id,i)=>({x:0.3+(i%9)*0.04,y:0.25+Math.floor(i/9)*0.04,z:0}));
base[0]={x:0.3,y:0.4,z:0};base[1]={x:0.7,y:0.4,z:0};base[2]={x:0.5,y:0.42,z:0};base[3]={x:0.5,y:0.46,z:0};
function simulate(motion){return Array.from({length:720},(_,i)=>{const t=i/60;return {time:t,landmarks:base.map((p,j)=>motion({...p},FACE_IDS[j],t))};});}
const analyse=frames=>analyzeFaceTracks([{id:1,frames}],640,480,[2,15],720);
const osc=(t,f)=>0.012*Math.sin(2*Math.PI*f*t);
test('Every supported local region recovers an isolated 5 Hz movement',()=>{
  for(const region of REGIONS){
    const ids=region.onlyGaps?region.gaps.map(g=>g[1]):region.groups.flat();const result=analyse(simulate((p,id,t)=>({...p,[region.gapAxis||'y']:p[region.gapAxis||'y']+(ids.includes(id)?osc(t,5):0)})));
    const found=result.find(r=>r.region===region.key);
    assert.equal(found.frequencies.length,1,region.key);assert.ok(Math.abs(found.frequency-5)<0.2);

  }
});
test('Head translation rotation and scale do not become local oscillations',()=>{
  const rs=analyse(simulate((p,id,t)=>{const a=0.03*Math.sin(2*Math.PI*5*t),s=1+0.02*Math.sin(2*Math.PI*5*t); const x=(p.x-.5)*640,y=(p.y-.5)*480;return {x:(s*(x*Math.cos(a)-y*Math.sin(a)))/640+.5+osc(t,5),y:s*(x*Math.sin(a)+y*Math.cos(a))/480+.5,z:0};}));
  assert.ok(rs.filter(r=>r.region!=='head').every(r=>!r.frequencies.length));
  assert.ok(Math.abs(rs[0].frequency-5)<.2);
});
test('Two independent facial regions retain different frequencies',()=>{
  const a=REGIONS[0].groups.flat(),b=REGIONS[8].groups.flat();
  const rs=analyse(simulate((p,id,t)=>({...p,y:p.y+(a.includes(id)?osc(t,3):b.includes(id)?osc(t,8):0)})));
  assert.ok(Math.abs(rs.find(r=>r.region===REGIONS[0].key).frequency-3)<.2);
  assert.ok(Math.abs(rs.find(r=>r.region===REGIONS[8].key).frequency-8)<.2);
});
test('One-point artefact, static face and a single transient yield no frequency',()=>{
  for(const fn of [(p)=>p,(p,id,t)=>({...p,y:p.y+(id===40?osc(t,5):0)}),(p,id,t)=>({...p,y:p.y+(id===40&&t>4&&t<4.2?.04:0)})])
    assert.ok(analyse(simulate(fn)).every(r=>!r.frequencies.length));
});
test('Multi-face frames rejected and long tracking gaps split tracks',()=>{
  const tracker=new FaceTracker();assert.deepEqual(tracker.add(0,[base,base]),[]);assert.equal(tracker.ambiguous,1);
  tracker.add(1,[base]);tracker.add(1.1,[base]);tracker.add(2,[base]);assert.equal(tracker.tracks.length,2);
});
test('Face CSV identifies region and original landmark IDs',()=>{
  const frames=simulate(p=>p),data={meta:{mode:'face',width:640,height:480},tracks:[{id:1,frames:frames.slice(0,1)}],results:analyse(frames)};
  assert.match(resultCSV(data),/upper-lip/);assert.match(resultCSV(data),/face_id/);assert.match(timeCSV(data),/"33"/);
});
test('Small local residuals matching global movement are withheld',()=>{
  const ids=REGIONS[0].groups.flat();
  const rs=analyse(simulate((p,id,t)=>({...p,x:p.x+osc(t,5),y:p.y+(ids.includes(id)?osc(t,5)*0.05:0)})));
  assert.ok(Math.abs(rs[0].frequency-5)<.2);
  const lip=rs.find(r=>r.region==='upper-lip');assert.deepEqual(lip.frequencies,[]);assert.match(lip.reason,/global/);
});
test('Two concurrent frequencies can coexist in a facial region',()=>{
  const ids=REGIONS[0].groups.flat();
  const r=analyse(simulate((p,id,t)=>({...p,y:p.y+(ids.includes(id)?osc(t,5)+osc(t,8):0)}))).find(r=>r.region==='upper-lip');
  assert.equal(r.frequencies.length,2);assert.ok(Math.abs(r.frequencies[0]-5)<.2);assert.ok(Math.abs(r.frequencies[1]-8)<.2);
});
