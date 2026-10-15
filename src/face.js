// Original MediaPipe landmark IDs; only these coordinates are retained.
export const REGIONS = [
  {key:'upper-lip', label:'Lèvre supérieure', groups:[[40,39,37,185],[0,13,82,312],[269,270,267,409]]},
  {key:'lower-lip', label:'Lèvre inférieure', groups:[[91,181,84,146],[17,14,87,317],[405,321,314,375]]},
  {key:'right-brow', label:'Sourcil droit', groups:[[70,46,63,53],[105,52,66,65],[107,55]], gaps:[[46,161],[52,159],[55,157]], gapLabel:'Hauteur sourcil–paupière'},
  {key:'left-brow', label:'Sourcil gauche', groups:[[300,276,293,283],[334,282,296,295],[336,285]], gaps:[[276,388],[282,386],[285,384]], gapLabel:'Hauteur sourcil–paupière'},
  {key:'forehead', label:'Front', groups:[[54,68,67,69],[10,151,9,8],[284,298,297,299]]},
  {key:'right-eye', label:'Paupières droites', groups:[[161,163,160,144],[159,145,158,153],[157,154,173,155]], gaps:[[161,163],[159,145],[157,154]], gapLabel:'Ouverture de la paupière'},
  {key:'left-eye', label:'Paupières gauches', groups:[[384,381,398,382],[386,374,385,380],[388,390,387,373]], gaps:[[384,381],[386,374],[388,390]], gapLabel:'Ouverture de la paupière'},
  {key:'right-cheek', label:'Joue droite', groups:[[50,101,100,36],[205,206,207,187],[117,118,119,123]]},
  {key:'left-cheek', label:'Joue gauche', groups:[[280,330,329,266],[425,426,427,411],[346,347,348,352]]},
  {key:'chin', label:'Menton / bas du visage', groups:[[170,169,171,140],[152,175,199,200],[395,396,394,369]]},
  {key:'nose', label:'Nez', groups:[[48,49,64,98],[1,2,4,5],[278,279,294,327]]},
  {key:'mouth-opening',label:'Ouverture de la bouche',groups:[[82,87],[13,14],[312,317]],gaps:[[82,87],[13,14],[312,317]],gapLabel:'Écart vertical entre les lèvres',onlyGaps:true},
  {key:'mouth-width',label:'Largeur de la bouche',groups:[[61,291],[78,308],[95,324]],gaps:[[61,291],[78,308],[95,324]],gapAxis:'x',gapLabel:'Écart horizontal entre les commissures',onlyGaps:true},
];
export const GLOBAL_REGION={key:'head',label:'Mouvement global du visage',groups:[[33],[263],[168,6]]};
const ANCHORS = [33,263,168,6];
export const FACE_IDS = [...new Set([...ANCHORS,...REGIONS.flatMap(r=>r.groups.flat())])];
export const FACE_CONNECTIONS = REGIONS.flatMap(r=>r.groups.flatMap(g=>g.slice(1).map((id,i)=>[FACE_IDS.indexOf(g[i]),FACE_IDS.indexOf(id)])));
export const compactFace = landmarks => FACE_IDS.map(id=>landmarks[id]);
const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
export class FaceTracker {
  constructor(){ this.tracks=[]; this.ambiguous=0; this.next=1; }
  add(time, faces){
    if(faces.length!==1){ if(faces.length>1)this.ambiguous++; return []; }
    const landmarks=faces[0];
    if(!landmarks.every(valid) || landmarks.length!==FACE_IDS.length) return [];
    const center={x:(landmarks[0].x+landmarks[1].x)/2,y:(landmarks[0].y+landmarks[1].y)/2};
    let t=this.tracks.at(-1);
    if(!t || time-t.last>0.25 || Math.hypot(center.x-t.center.x,center.y-t.center.y)>0.15){
      t={id:this.next++,frames:[]}; this.tracks.push(t);
    }
    t.last=time; t.center=center; t.frames.push({time,landmarks});
    return [{id:t.id,landmarks}];
  }
}
// Fit a 2D similarity transform using anchors outside the analysed regions.
// It removes in-plane head translation/rotation/scale, NOT out-of-plane motion.
export function stabilizedFrames(frames,width,height){
  const xy=p=>({x:p.x*width,y:p.y*height});
  const center=ps=>({x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length});
  const ref=frames[0]?.landmarks.slice(0,4).map(xy);
  if(!ref || !ref.every(valid))return [];
  const rc=center(ref), base=ref.map(p=>({x:p.x-rc.x,y:p.y-rc.y}));
  const eyeDistance=Math.hypot(ref[1].x-ref[0].x,ref[1].y-ref[0].y);
  if(eyeDistance<20)return [];
  return frames.map(f=>{
    const ps=f.landmarks.slice(0,4).map(xy), pc=center(ps);
    let den=0,dot=0,cross=0;
    ps.forEach((p,i)=>{const x=p.x-pc.x,y=p.y-pc.y; den+=x*x+y*y; dot+=x*base[i].x+y*base[i].y; cross+=x*base[i].y-y*base[i].x;});
    const a=dot/den,b=cross/den, scale=Math.hypot(a,b);
    const transform=p=>({x:a*(p.x-pc.x)-b*(p.y-pc.y)+rc.x,y:b*(p.x-pc.x)+a*(p.y-pc.y)+rc.y});
    const residual=Math.sqrt(ps.reduce((s,p,i)=>{const q=transform(p);return s+(q.x-ref[i].x)**2+(q.y-ref[i].y)**2;},0)/4)/eyeDistance;
    const ok=Number.isFinite(scale)&&scale>0.7&&scale<1.4&&residual<0.03;
    return {time:f.time,landmarks:ok?f.landmarks.map(p=>transform(xy(p))):null};
  });
}
export function faceSignals(frames,region){
  const coordinates=region.onlyGaps?[]:region.groups.flatMap((ids,group)=>ids.flatMap(id=>['x','y'].map(axis=>({
    family:'relative',point:id,pointIds:[id],axis,group,measurement:'Déplacement '+axis+' du point '+id,
    samples:frames.map(f=>({t:f.time,v:f.landmarks?.[FACE_IDS.indexOf(id)]?.[axis]??null})),
  }))));
  // Signed separations preserve the oscillation's direction; a radial norm
  // around a reference point could turn f into 2f when crossing zero.
  const axis=region.gapAxis||'y';
  const gaps=(region.gaps||[]).map(([a,b],group)=>({family:'relative',point:a,pointIds:[a,b],axis:'gap-'+axis,group,measurement:region.gapLabel,
    samples:frames.map(f=>{const p=f.landmarks?.[FACE_IDS.indexOf(a)],q=f.landmarks?.[FACE_IDS.indexOf(b)];return {t:f.time,v:p&&q?q[axis]-p[axis]:null};}),
  }));
  return [...coordinates,...gaps];
}
