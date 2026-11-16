let model;
export const links=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32],[0,7],[0,8]];
export async function detectPose(image){
 if(!model){const {PoseLandmarker,FilesetResolver}=await import('../vendor/vision_bundle.mjs');const files=await FilesetResolver.forVisionTasks(new URL('../vendor/wasm/',import.meta.url).href);model=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('../vendor/pose_landmarker_full.task',import.meta.url).href,delegate:'CPU'},runningMode:'IMAGE',numPoses:2,minPoseDetectionConfidence:.6,minPosePresenceConfidence:.6,outputSegmentationMasks:false});}
 const result=model.detect(image);
 if(result.landmarks.length!==1)throw Error(result.landmarks.length?'Plusieurs personnes détectées : utilisez une image avec une seule personne.':'Aucun squelette fiable détecté. Vous pouvez placer les repères manuellement.');
 return result.landmarks[0].map(p=>({...p,x:p.x*image.width,y:p.y*image.height}));
}
export function proposals(p,mode,w,h){
 const ok=i=>p[i]&&(p[i].visibility??0)>.6;
 if(![11,12,23,24].every(ok))return [];
 const middle=(a,b)=>({x:(p[a].x+p[b].x)/2,y:(p[a].y+p[b].y)/2});
 const hip=middle(23,24),shoulder=middle(11,12);
 if(mode==='upper')return [hip,{x:(hip.x+shoulder.x)/2,y:(hip.y+shoulder.y)/2},shoulder];
 if(mode==='lower'){const side=(p[27]?.visibility??0)>(p[28]?.visibility??0)?27:28;if(!ok(side))return [];return [{x:p[side].x,y:p[side].y},hip,shoulder];}
 // Only the trunk is proposed: a real vertical must be marked by the operator.
 return [hip,shoulder];
}
export function closePose(){model?.close();model=null;}
