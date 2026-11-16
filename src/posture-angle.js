// Image-plane geometry, in isotropic image pixels. No anatomical inference.
export function flexion(lower, vertex, upper) {
  const a={x:vertex.x-lower.x,y:vertex.y-lower.y};
  const b={x:upper.x-vertex.x,y:upper.y-vertex.y};
  const na=Math.hypot(a.x,a.y),nb=Math.hypot(b.x,b.y);
  if(na<10||nb<10)throw Error('Repères trop proches : espacez les points.');
  return Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.y*b.y)/(na*nb))))*180/Math.PI;
}
export function inclination(base,top,verticalBottom,verticalTop){
  const a={x:top.x-base.x,y:top.y-base.y},b={x:verticalTop.x-verticalBottom.x,y:verticalTop.y-verticalBottom.y};
  if(Math.hypot(a.x,a.y)<10||Math.hypot(b.x,b.y)<10)throw Error('Repères trop proches : espacez les points.');
  const dot=a.x*b.x+a.y*b.y;
  if(dot<=0)throw Error('Placez les repères dans l’ordre indiqué, du bas vers le haut.');
  return Math.atan2(Math.abs(a.x*b.y-a.y*b.x),dot)*180/Math.PI;
}
