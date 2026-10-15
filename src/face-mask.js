import { FACE_IDS, FACE_CONNECTIONS } from './face.js';

// Same compact landmark order as the video overlay. Preserve video aspect ratio;
// do not mirror or substitute a generic face. Red denotes signal contributors,
// not a proven anatomical origin (especially for shared mesh oscillations).
export function maskGeometry(track, result, width, height) {
  const frame=track?.frames?.[Math.floor(track.frames.length/2)];
  if(!frame?.landmarks || !(width>0 && height>0))return null;
  const active=new Set(result.frequencies?.length?result.contributingPointIds:[]);
  const points=frame.landmarks.map((p,i)=>({x:p.x*width,y:p.y*height,id:FACE_IDS[i],active:active.has(FACE_IDS[i])}));
  if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),minY=Math.min(...ys),span=Math.max(Math.max(...xs)-minX,Math.max(...ys)-minY,1),pad=span*.1;
  return {points,connections:FACE_CONNECTIONS,viewBox:[minX-pad,minY-pad,Math.max(...xs)-minX+2*pad,Math.max(...ys)-minY+2*pad],radius:span*.009};
}

export function faceMask(track,result,width,height) {
  const geometry=maskGeometry(track,result,width,height);if(!geometry)return null;
  const ns='http://www.w3.org/2000/svg';
  const element=(name,attrs)=>{const e=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const svg=element('svg',{viewBox:geometry.viewBox.join(' '),role:'img','aria-label':'Masque du visage : points contribuant au signal en rouge, autres points suivis en vert',class:'face-result-mask'});
  const title=element('title',{});title.textContent='Points contribuant à la fréquence affichée — localisation indicative';svg.append(title);
  for(const [a,b]of geometry.connections){const p=geometry.points[a],q=geometry.points[b];svg.append(element('line',{x1:p.x,y1:p.y,x2:q.x,y2:q.y,stroke:'#38debd','stroke-width':geometry.radius*.5,opacity:.65}));}
  for(const p of [...geometry.points].sort((a,b)=>Number(a.active)-Number(b.active))){svg.append(element('circle',{cx:p.x,cy:p.y,r:geometry.radius*(p.active?1.4:1),fill:p.active?'#dc3545':'#38debd','data-point-id':p.id,'data-active':p.active,stroke:p.active?'#fff':'none','stroke-width':geometry.radius*.3}));}
  return svg;
}
