// Blue circular marker: coordinates and diameter in decoded-frame pixels.
export function blueMarkers({data,width,height}) {
 const seen=new Uint8Array(width*height), blobs=[];
 const blue=i=>{const k=i*4,r=data[k],g=data[k+1],b=data[k+2];return b>65&&b>r*1.35&&b>g*1.15&&b-r>35;};
 for(let i=0;i<seen.length;i++){
  if(seen[i]||!blue(i))continue;
  const queue=[i];seen[i]=1;let sx=0,sy=0,xx=0,yy=0,xy=0;
  for(let q=0;q<queue.length;q++){const j=queue[q],x=j%width,y=Math.floor(j/width);sx+=x;sy+=y;xx+=x*x;yy+=y*y;xy+=x*y;
   for(const n of [x>0?j-1:-1,x<width-1?j+1:-1,y>0?j-width:-1,y<height-1?j+width:-1])if(n>=0&&!seen[n]&&blue(n)){seen[n]=1;queue.push(n);}
  }
  const n=queue.length,x=sx/n,y=sy/n,a=xx/n-x*x,b=yy/n-y*y,c=xy/n-x*y,delta=Math.hypot(a-b,2*c),major=(a+b+delta)/2,minor=(a+b-delta)/2;
  const diameter=4*Math.sqrt(major),fill=n/(Math.PI*diameter*diameter/4);
  if(n>=40&&diameter>=8&&minor/major>0.75&&fill>0.75&&fill<1.2)blobs.push({x,y,diameter});
 }
 return blobs;
}
export function amplitudeCm(frames, representative, frequencies, width,height){
 const markers=frames.filter(f=>f.marker).map(f=>f.marker.diameter);
 if(markers.length<32||markers.length/frames.length<0.8||!representative?.result)return null;
 markers.sort((a,b)=>a-b);const d=markers[Math.floor(markers.length/2)];
 if((markers[Math.floor(markers.length*.9)]-markers[Math.floor(markers.length*.1)])/d>.15)return null;
 const {times,values}=representative.result.grid,n=times.length,mid=times.reduce((a,b)=>a+b,0)/n;
 // Joint least-squares fit: intercept, drift, sine/cosine for each accepted frequency.
 const rows=times.map(t=>[1,t-mid,...frequencies.flatMap(f=>[Math.sin(2*Math.PI*f*t),Math.cos(2*Math.PI*f*t)])]),m=rows[0].length;
 const a=Array.from({length:m},(_,i)=>Array.from({length:m+1},(_,j)=>rows.reduce((s,r,k)=>s+r[i]*(j===m?values[k]:r[j]),0)));
 for(let i=0;i<m;i++){let pivot=i;for(let k=i+1;k<m;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;[a[i],a[pivot]]=[a[pivot],a[i]];const v=a[i][i];if(Math.abs(v)<1e-10)return null;for(let j=i;j<=m;j++)a[i][j]/=v;for(let k=0;k<m;k++)if(k!==i){const v=a[k][i];for(let j=i;j<=m;j++)a[k][j]-=v*a[i][j];}}
 return frequencies.map((f,i)=>({frequency:f,peakToPeak:2*Math.hypot(a[2+2*i][m],a[3+2*i][m])/d}));
}
