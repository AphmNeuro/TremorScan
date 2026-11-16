import test from 'node:test';import assert from 'node:assert/strict';
import {flexion,inclination} from '../src/posture-angle.js';
for(const angle of [0,10,30,45,60,90])test('Flexion '+angle,()=>{const r=angle*Math.PI/180;assert.ok(Math.abs(flexion({x:100,y:200},{x:100,y:100},{x:100+100*Math.sin(r),y:100-100*Math.cos(r)})-angle)<1e-6);});
test('Pisa corrected for camera roll and mirror',()=>{for(const sign of [-1,1]){const roll=.2,a=.2+sign*Math.PI/18;assert.ok(Math.abs(inclination({x:0,y:0},{x:100*Math.sin(a),y:-100*Math.cos(a)},{x:0,y:0},{x:100*Math.sin(roll),y:-100*Math.cos(roll)})-10)<1e-6);}});
test('Coincident and reversed reference points rejected',()=>{assert.throws(()=>flexion({x:0,y:0},{x:0,y:0},{x:0,y:-100}));assert.throws(()=>inclination({x:0,y:0},{x:0,y:-100},{x:0,y:0},{x:0,y:100}));});
