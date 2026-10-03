const H=348,BASE=15,BODYW=81,BODYD=195,CENTER=6,BAND_T=0.44,BAND_H=6,BAND_GAP=6,BAND_RAISE=3,FILL_CAP=32768;
const halfAt=(t:number)=>{const w=0.55+0.45*Math.sin(Math.PI*Math.min(1,t*1.08))-0.10*Math.exp(-((t-0.62)**2)/0.006);
 const d=0.62+0.38*Math.sin(Math.PI*(0.25+t*0.72));
 return {hw:Math.max(4,Math.round((BODYW*Math.max(0.42,w))/2)),hd:Math.max(8,Math.round((BODYD*Math.max(0.5,d))/2))};};
const xHalfAt=(hw:number,hd:number,az:number)=>{if(az>hd)return 0;const a=Math.floor(((hw+1)*(1-az/hd))/0.28);return Math.max(0,Math.min(hw,a));};
type Row={y:number;z:number;x0:number;x1:number;b:string};
const rows:Row[]=[];
for(let y=BASE;y<BASE+H;y++){const t=(y-BASE)/H;const{hw,hd}=halfAt(t);
 const rel=y-Math.round(BASE+H*BAND_T);const bi=Math.floor(rel/(BAND_H+BAND_GAP));
 const inBand=rel>=0&&bi>=0&&bi<3&&rel%(BAND_H+BAND_GAP)<BAND_H;
 const hdB=inBand?hd+BAND_RAISE:hd;const trim=Math.floor(y/12)%2===0;
 for(let z=-hdB;z<=hdB;z++){const xh=xHalfAt(hw,hd,Math.abs(z));if(xh<1)continue;
  const outer=Math.abs(z)>=hd-2;const b=inBand?'black_concrete':(outer&&trim?'smooth_quartz':'white_concrete');
  const c0=Math.min(CENTER,xh),c1=Math.max(-CENTER,-xh);
  if(c0>c1)rows.push({y,z,x0:-xh,x1:xh,b});
  else{if(-xh<=-CENTER-1)rows.push({y,z,x0:-xh,x1:-CENTER-1,b});rows.push({y,z,x0:-CENTER,x1:CENTER,b:'black_concrete'});
   if(CENTER+1<=xh)rows.push({y,z,x0:CENTER+1,x1:xh,b});}}}
for(let y=0;y<BASE;y++){const r=Math.max(3,Math.round(27*(1-y/(BASE*2.6))));
 for(let z=-r;z<=r;z++){const xh=Math.round(r*Math.sqrt(Math.max(0,1-(z*z)/(r*r))));if(xh<1)continue;
  rows.push({y,z,x0:-xh,x1:xh,b:y===0?'polished_blackstone':'black_concrete'});}}
const v=(o:{x0:number;x1:number;y:number;z:number})=>(o.x1-o.x0+1);
let vox=0;for(const r of rows)vox+=v(r);
const runs:any[]=rows.map(r=>({from:{x:r.x0,y:r.y,z:r.z},to:{x:r.x1,y:r.y,z:r.z},block:r.b}));
const groups=new Map<string,any[]>();
for(const op of runs){const k=`${op.from.x},${op.to.x},${op.from.z},${op.block}`,g=groups.get(k)??[];g.push(op);groups.set(k,g);}
const merged:any[]=[];
for(const g of groups.values()){g.sort((a,b)=>a.from.y-b.from.y);
 for(let i=0;i<g.length;){let j=i;
  while(j+1<g.length&&g[j+1].from.y===g[j].to.y+1&&(g[j+1].to.y-g[i].from.y+1)*(g[i].to.x-g[i].from.x+1)<=FILL_CAP)j++;
  merged.push({...g[i],to:{...g[i].to,y:g[j].to.y}});i=j+1;}}
let worst=0,over=0;for(const op of merged){const q=(Math.abs(op.to.x-op.from.x)+1)*(Math.abs(op.to.y-op.from.y)+1)*(Math.abs(op.to.z-op.from.z)+1);worst=Math.max(worst,q);if(q>FILL_CAP)over++;}
const span=89,step=Math.ceil(span/4),sb:number[]=[];for(let i=0;i<=4;i++)sb.push(-44+Math.min(i*step,span));
const slabs:any[][]=[[],[],[],[]];
for(const op of merged)for(let i=0;i<4;i++){const lo=Math.max(op.from.x,sb[i]),hi=Math.min(op.to.x,sb[i+1]-1);if(lo>hi)continue;
 slabs[i].push({from:{...op.from,x:lo},to:{...op.to,x:hi},block:op.block});}
const cut=slabs.flat();const vol=(o:any)=>(Math.abs(o.to.x-o.from.x)+1)*(Math.abs(o.to.y-o.from.y)+1)*(Math.abs(o.to.z-o.from.z)+1);
const srcV=merged.reduce((a,o)=>a+vol(o),0),cutV=cut.reduce((a,o)=>a+vol(o),0);
const ov=cut.some((a,i)=>cut.some((b,j)=>j>i&&a.from.x<=b.to.x&&b.from.x<=a.to.x&&a.from.y<=b.to.y&&b.from.y<=a.to.y&&a.from.z<=b.to.z&&b.from.z<=a.to.z));
console.log(JSON.stringify({rows:rows.length,placementVoxels:vox,bodyCommands:merged.length,worstRun:worst,runsOverCap:over,
 perWorker:slabs.map(s=>s.length),cutCommands:cut.length,volumeMatch:srcV===cutV,srcV,cutV,overlap:ov,
 dims:[BODYW,BASE+H,BODYD],ratioHW:+((BASE+H)/BODYW).toFixed(2),targetHW:4.36,ratioHD:+((BASE+H)/BODYD).toFixed(2),targetHD:1.80},null,2));
