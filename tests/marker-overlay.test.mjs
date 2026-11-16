import test from 'node:test';import assert from 'node:assert/strict';import {overlay} from '../src/charts.js';
test('Black marker outline uses normalized coordinates; absent marker leaves no outline',()=>{
 const arcs=[],colors=[];const ctx={clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){colors.push(this.strokeStyle)},fill(){},save(){},restore(){},arc(...a){arcs.push(a)}};
 const canvas={width:640,height:480,getContext:()=>ctx};const video={videoWidth:640,videoHeight:480};const hand={landmarks:Array.from({length:21},()=>({x:.5,y:.5})),marker:{x:.4,y:.3,diameter:.04}};
 overlay(canvas,video,[hand]);assert.equal(colors.at(-1),'#000');assert.equal(arcs.at(-1)[0],256);assert.equal(arcs.at(-1)[1],144);assert.equal(arcs.length,22);
 arcs.length=0;overlay(canvas,video,[{landmarks:hand.landmarks}]);assert.equal(arcs.length,21);
});
