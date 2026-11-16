let model;
export const links=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32],[0,7],[0,8]];
export async function detectPose(image){
 if(!model){const {PoseLandmarker,FilesetResolver}=await import('../vendor/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks(new URL('../vendor/wasm/',import.meta.url).href);model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('../vendor/pose_landmarker_heavy.task',import.meta.url).href,delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,outputSegmentationMasks:false});}
 const result=model.detect(image);
 if(result.landmarks.length!==1)throw Error(result.landmarks.length?'Plusieurs personnes détectées : utilisez une image avec une seule personne.':'Aucun squelette fiable détecté. Vous pouvez placer les repères manuellement.');
 let points=result.landmarks[0];
 // A second, tighter view helps when the person occupies a small image area.
 const visible=points.filter(p=>reliable(p));
 if(visible.length>=8){
   const xs=visible.map(p=>p.x),ys=visible.map(p=>p.y);
   const left=Math.max(0,Math.min(...xs)-.10),top=Math.max(0,Math.min(...ys)-.10);
   const right=Math.min(1,Math.max(...xs)+.10),bottom=Math.min(1,Math.max(...ys)+.10);
   if((right-left)*(bottom-top)<.55){
     const crop=document.createElement('canvas');crop.width=Math.round((right-left)*image.width);crop.height=Math.round((bottom-top)*image.height);
     crop.getContext('2d').drawImage(image,left*image.width,top*image.height,crop.width,crop.height,0,0,crop.width,crop.height);
     const refined=model.detect(crop);
     if(refined.landmarks.length===1){
       const candidate=refined.landmarks[0].map(p=>({...p,x:left+p.x*(right-left),y:top+p.y*(bottom-top)}));
       const core=[11,12,23,24],score=p=>core.reduce((s,i)=>s+(p[i].visibility??0),0);
       const agrees=core.filter(i=>Math.hypot(candidate[i].x-points[i].x,candidate[i].y-points[i].y)<.08).length>=3;
       if(agrees&&score(candidate)>score(points))points=candidate;
     }
   }
 }
 return points.map(p=>({...p,x:p.x*image.width,y:p.y*image.height,usable:reliable(p)}));
}
export function reliable(p){return Boolean(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??0)>=.75&&(p.presence??1)>=.75);}
export function proposals(p,mode,w,h){
 const ok=i=>p[i]?.usable===true;
 if(![11,12,23,24].every(ok))return [];
 const middle=(a,b)=>({x:(p[a].x+p[b].x)/2,y:(p[a].y+p[b].y)/2});
 const hip=middle(23,24),shoulder=middle(11,12);
 if(mode==='upper')return [hip,{x:(hip.x+shoulder.x)/2,y:(hip.y+shoulder.y)/2},shoulder];
 if(mode==='lower'){const side=(p[27]?.visibility??0)>(p[28]?.visibility??0)?27:28;if(!ok(side))return [];return [{x:p[side].x,y:p[side].y},hip,shoulder];}
 // Only the trunk is proposed: a real vertical must be marked by the operator.
 return [hip,shoulder];
}
export function closePose(){model?.close();model=null;}
