import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
export const W=384,D=448,MAX_Y=154;
export const vox=new Map<string,string>(), jobs=new Map<string,string>(), structures:Array<Record<string,unknown>>=[],labels:Array<{x:number,y:number,z:number,text:string}>=[];
let phase='konoha_terrain';
export const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
export const put=(x:number,y:number,z:number,b:string)=>{if(x<0||x>=W||z<0||z>=D||y<0||y>MAX_Y)throw Error(`Design outside reservation ${x},${y},${z}`);const k=key(x,y,z);vox.set(k,b);jobs.set(k,phase);};
export function box(x:number,y:number,z:number,X:number,Y:number,Z:number,b:string){for(let i=x;i<=X;i++)for(let j=y;j<=Y;j++)for(let k=z;k<=Z;k++)put(i,j,k,b);}
function cut(x:number,y:number,z:number,X:number,Y:number,Z:number){for(let i=x;i<=X;i++)for(let j=y;j<=Y;j++)for(let k=z;k<=Z;k++){vox.delete(key(i,j,k));jobs.delete(key(i,j,k));}}
const rand=(x:number,z:number,seed=0)=>{const n=Math.sin(x*127.1+z*311.7+seed*73.9)*43758.5453;return n-Math.floor(n);};
const label=(x:number,y:number,z:number,text:string)=>labels.push({x,y,z,text});
function flatten(x:number,z:number,X:number,Z:number,h=6,b='grass_block'){for(let i=x;i<=X;i++)for(let k=z;k<=Z;k++){for(let y=0;y<=h;y++)put(i,y,k,y===h?b:y>=h-2?'dirt':'stone');for(let y=h+1;y<=12;y++)vox.delete(key(i,y,k));}}
function line(points:number[][],width:number,b='packed_mud'){for(let i=1;i<points.length;i++){const [a,c]=[points[i-1],points[i]],n=Math.ceil(Math.hypot(c[0]-a[0],c[1]-a[1]));for(let t=0;t<=n;t++){const x=Math.round(a[0]+(c[0]-a[0])*t/n),z=Math.round(a[1]+(c[1]-a[1])*t/n);const r=Math.floor(width/2);flatten(Math.max(0,x-r),Math.max(0,z-r),Math.min(W-1,x+r),Math.min(D-1,z+r),6,b);}}}
function lamp(x:number,z:number,h=6){box(x,h+1,z,x,h+4,z,'dark_oak_fence');put(x,h+5,z,'lantern');}
function roof(x:number,z:number,w:number,d:number,y:number,variant:number){const L=x-Math.floor(w/2)-2,R=x+Math.floor(w/2)+2,B=z-Math.floor(d/2)-2,F=z+Math.floor(d/2)+2;
const materials=['bricks','red_terracotta','dark_oak_planks','orange_terracotta','dark_prismarine','mud_bricks','brown_terracotta'];const m=materials[variant%materials.length];
for(let xx=L;xx<=R;xx++)for(let zz=B;zz<=F;zz++){let a=variant%3===0?Math.min(xx-L,R-xx,zz-B,F-zz):variant%3===1?Math.min(xx-L,R-xx):Math.min(zz-B,F-zz);let h=Math.floor(a*.65);put(xx,y+h,zz,m);if(h>0)put(xx,y+h-1,zz,m);}
for(const zz of [B,F])box(L,y,zz,R,y,zz,'dark_oak_slab[type=bottom]');for(const xx of [L,R])box(xx,y,B,xx,y,F,'dark_oak_slab[type=bottom]');
// Swept corners and a raised ridge distinguish the eaves from flat boxes.
for(const xx of [L,R])for(const zz of [B,F])put(xx,y+1,zz,'dark_oak_stairs[facing=north]');
}
function building(cx:number,cz:number,w:number,d:number,floors:number,variant:number,name:string,kind='residential'){
const L=cx-Math.floor(w/2),R=cx+Math.floor(w/2),B=cz-Math.floor(d/2),F=cz+Math.floor(d/2),base=6,top=base+floors*7;
flatten(L-2,B-2,R+2,F+2);cut(L+1,7,B+1,R-1,top-1,F-1);const wall=['white_terracotta','smooth_sandstone','terracotta','white_concrete','light_gray_terracotta','stripped_birch_wood','mud_bricks','yellow_terracotta','orange_terracotta','calcite'][variant%10];
for(let y=base+1;y<top;y++){box(L,y,B,R,y,B,wall);box(L,y,F,R,y,F,wall);box(L,y,B,L,y,F,wall);box(R,y,B,R,y,F,wall);}
for(let f=0;f<=floors;f++){const y=base+f*7;box(L,y,B,R,y,F,'spruce_planks');for(const xx of [L,R])box(xx,y,B,xx,Math.min(y+6,top),F,'dark_oak_log');if(f<floors){for(let xx=L+3;xx<R-1;xx+=4)for(const zz of [B,F])box(xx,y+3,zz,Math.min(xx+1,R-2),y+4,zz,'glass_pane');for(let zz=B+3;zz<F-1;zz+=4)for(const xx of [L,R])box(xx,y+3,zz,xx,y+4,zz+1,'glass_pane');}}
// Open main threshold with a door leaf to one side of the walkable arch.
cut(cx-1,7,F,cx+1,9,F);put(cx-1,7,F,'oak_door[half=lower,facing=south,open=true]');put(cx-1,8,F,'oak_door[half=upper,facing=south,open=true]');
for(let f=0;f<floors;f++){const fy=6+f*7;for(let s=1;s<=7;s++){const zz=F-2-s;cut(L+2,fy+s+1,zz,L+3,Math.min(top-1,fy+10),zz);box(L+2,fy+s,zz,L+3,fy+s,zz,'spruce_stairs[facing=north]');}}
roof(cx,cz,w,d,top,variant);
// Selected balconies, timber lintels, drainpipes and rooftop water tanks.
if(variant%3===0&&floors>1){box(cx-4,13,F+1,cx+4,13,F+3,'spruce_planks');box(cx-4,14,F+3,cx+4,14,F+3,'oak_fence');cut(cx,14,F,cx+1,16,F);}
if(variant%4===1){box(R-4,top+3,B+3,R-2,top+5,B+5,'stripped_spruce_wood');box(R-4,top+2,B+3,R-2,top+2,B+5,'oak_fence');}
for(let f=0;f<floors;f++)put(cx,6+f*7+6,cz,'sea_lantern');
if(kind==='commercial'||variant%4===0){box(R-5,7,B+2,R-2,7,B+3,'barrel');put(cx+2,7,cz,'crafting_table');box(cx+1,7,F-3,cx+3,7,F-3,'oak_stairs[facing=north]');}
if(kind==='residential'&&variant%5===0){put(R-3,7,B+2,'red_bed[part=foot,facing=north]');put(R-3,7,B+1,'red_bed[part=head,facing=north]');box(cx,7,B+2,cx+2,8,B+2,'bookshelf');}
const roads=[119,156,192,236,282,335,383,419];const target=roads.find(v=>v>F+1)??419;line([[cx,F+1],[cx,target]],3);
if(kind==='commercial'){for(let xx=L+1;xx<R;xx++)put(xx,10,F+2,(xx-L)%4<2?'red_wool':'white_wool');label(cx,12,F+3,name);}
structures.push({id:name,kind,bounds:{from:[L,6,B],to:[R,top+10,F]},entrance:[cx,7,F],interior:[cx,7,cz],stories:floors,variant});
}
function leaf(cx:number,cy:number,cz:number,r:number,rx=r){for(let x=Math.max(0,cx-rx);x<=Math.min(W-1,cx+rx);x++)for(let y=cy-r;y<=cy+r;y++)for(let z=Math.max(0,cz-r);z<=Math.min(D-1,cz+r);z++)if(((x-cx)/rx)**2+((y-cy)/r)**2+((z-cz)/r)**2<=1.15)put(x,y,z,'oak_leaves[persistent=true]');}
function tree(x:number,z:number,h:number,variant:number,ground=6){const bend=variant%3-1;for(let y=ground+1;y<=ground+h;y++){const dx=Math.floor((y-ground)/8)*bend;box(x+dx,y,z,x+dx+(h>20?1:0),y,z+(h>20?1:0),'oak_log');}leaf(x+bend*Math.floor(h/8),ground+h,z,h>20?6:4);for(const s of [-1,1]){for(let t=0;t<5;t++)put(x+s*t,ground+h-5+Math.floor(t/2),z+variant%3,'oak_log');leaf(x+s*4,ground+h-3,z+variant%3,4);}if(h>20)for(const s of [-1,1])box(x+s,ground+1,z,x+s,ground+2,z,'oak_log');}
function terrain(){for(let x=0;x<W;x++)for(let z=0;z<D;z++){const outer=x<28||x>355||z<120||z>427;const h=outer?Math.max(2,Math.round(6+2*Math.sin(x/37)*Math.cos(z/42)+Math.sin(z/18))):6;for(let y=0;y<=h;y++)put(x,y,z,y===h?'grass_block':y>=h-2?'dirt':'stone');}}
function mountain(){
for(let x=68;x<=315;x++)for(let z=8;z<=127;z++){const dx=(x-192)/124,front=119+Math.round(5*Math.sin(x/21)+3*Math.cos(x/37));if(Math.abs(dx)>1||z>front)continue;const back=Math.max(0,Math.min(1,(z-8)/28)),edge=Math.pow(Math.max(0,1-dx*dx),.23);let h=Math.round((132+8*Math.sin(x/31)+5*Math.cos(z/23))*edge*Math.pow(back,.65));h=Math.min(149,h);if(h<8)continue;
for(let y=7;y<=h;y++){if(y>14&&y<h-5&&z>14&&z<front-4&&Math.abs(dx)<.97)continue;const crack=(Math.floor(x/11)+Math.floor(y/13)+Math.floor(z/9))%11;const b=y===h?'grass_block':y>=h-2?'dirt':crack===0?'tuff':crack<3?'andesite':crack===6?'cobblestone':'stone';put(x,y,z,b);}}
structures.push({id:'hokage_mountain',kind:'mountain',bounds:{from:[68,7,8],to:[315,149,127]}});
// Five bas-reliefs are carved into, and backed by, the cliff surface.
const names=['Hashirama Senju','Tobirama Senju','Hiruzen Sarutobi','Minato Namikaze','Tsunade'];
phase='konoha_hokage_faces';
for(let f=0;f<5;f++){const cx=102+f*45,cy=84;for(let x=cx-19;x<=cx+19;x++)for(let y=cy-25;y<=cy+29;y++){const dx=x-cx,dy=y-cy,half=dy<-12?17+(dy+12)*.35:17;const front=119+Math.round(5*Math.sin(x/21)+3*Math.cos(x/37));let isFace=(dx/half)**2+(dy/25)**2<=1;
let hair=dy>15&&dy<25+(f===1||f===3?Math.floor((Math.sin(dx*1.8)+1)*3):0)&&Math.abs(dx)<19;
if((f===0||f===4)&&Math.abs(dx)>13&&Math.abs(dx)<19&&dy>-17&&dy<23)hair=true;
if(f===2&&dy>16&&dy<26&&Math.abs(dx)<19-Math.max(0,dy-23)*2)hair=true;
if(!isFace&&!hair)continue;let relief=3+Math.round(4*Math.sqrt(Math.max(0,1-(dx/19)**2-(dy/27)**2)));let material=hair?'andesite':'stone';
if(Math.abs(dx)<3&&dy>-6&&dy<8)relief+=Math.round(5*(1-Math.abs(dx)/4));
if(Math.abs(Math.abs(dx)-7)<4&&dy>1&&dy<5){relief-=4;material='tuff';}
if(Math.abs(Math.abs(dx)-7)<5&&dy===6){relief+=2;material='polished_andesite';}
if(Math.abs(dx)<7&&dy===-11){relief-=3;material='tuff';}
if(Math.abs(dx)<6&&dy===-13)relief+=2;
if(f===4&&Math.abs(dx)<2&&dy===12)material='polished_andesite';
if(f===1&&Math.abs(dx)>10&&dy<0&&dy>-14)material='polished_diorite';
for(let z=front-3;z<=front+relief;z++)put(x,y,z,material);
for(let z=front+relief+1;z<=front+14;z++)vox.delete(key(x,y,z));
}label(cx,55,135,`${f+1}. ${names[f]}`);structures.push({id:`hokage_face_${f+1}`,kind:'relief',hokage:names[f],bounds:{from:[cx-19,59,111],to:[cx+19,113,137]}});}
// Organic ridgeline trees and boulders merge the mountain into the forest.
phase='konoha_mountain';
for(let x=85;x<=300;x+=21){const z=35+Math.floor(rand(x,4)*30);let h=0;for(let y=7;y<=149;y++)if(vox.has(key(x,y,z)))h=y;if(h>8&&h<125)tree(x,z,14,Math.floor(rand(x,z)*5),h);}
}
function streets(){line([[192,444],[192,394],[194,351],[188,307],[192,276],[192,197],[192,181]],11,'sandstone');
for(const z of [119,156,192,236,282,335,383,419])line([[29,z],[91,z+(z===236?2:0)],[164,z],[223,z],[294,z-2],[355,z]],z===192||z===282?7:5);
for(const x of [28,61,94,127,160,226,259,292,325,356])line([[x,119],[x+(x%2?1:0),235],[x,282],[x,419]],3);
flatten(170,239,214,283,6,'smooth_sandstone');structures.push({id:'central_plaza',kind:'plaza',bounds:{from:[170,6,239],to:[214,13,283]}});
}
function walls(){
for(let z=118;z<=427;z++){const l=25+Math.round(4*Math.sin(z/45)),r=358+Math.round(3*Math.sin(z/39));for(const x of [l,r]){if(z>=331&&z<=339)continue;box(x-2,7,z,x+2,23,z,'smooth_sandstone');box(x-2,24,z,x+2,24,z,'dark_oak_planks');put(x-2,25,z,'oak_fence');put(x+2,25,z,'oak_fence');}}
for(let x=26;x<=359;x++){const z=428+Math.round(3*Math.sin(x/33));if(x>=178&&x<=206)continue;box(x,7,z-2,x,23,z+2,'smooth_sandstone');box(x,24,z-2,x,24,z+2,'dark_oak_planks');put(x,25,z-2,'oak_fence');put(x,25,z+2,'oak_fence');}
for(const [x,z,v]of [[26,135,0],[27,218,1],[26,306,2],[27,396,3],[358,143,1],[357,226,2],[359,310,0],[357,395,3],[86,430,2],[297,429,1]]){
flatten(x-5,z-5,x+5,z+5);const h=28+v*2;for(let y=7;y<=h;y++){box(x-4,y,z-4,x+4,y,z-4,'stripped_oak_wood');box(x-4,y,z+4,x+4,y,z+4,'stripped_oak_wood');box(x-4,y,z-4,x-4,y,z+4,'stripped_oak_wood');box(x+4,y,z-4,x+4,y,z+4,'stripped_oak_wood');}box(x-4,24,z-4,x+4,24,z+4,'spruce_planks');cut(x-1,25,z-4,x+1,27,z-4);box(x-4,h,z-4,x+4,h,z+4,'spruce_planks');roof(x,z,11,11,h+1,v);box(x-3,7,z-1,x-3,h-1,z-1,'ladder[facing=east]');lamp(x,z,h);structures.push({id:`watchtower_${x}_${z}`,kind:'watchtower',height:h+6});}
// Gate with guard rooms, continuous upper passage and a 25-block archway.
for(const x of [167,217])building(x,429,13,17,3,2,`gate_guard_${x}`,'guard');
for(const x of [175,209])box(x,7,425,x+2,33,434,'stripped_dark_oak_wood');box(175,29,425,211,33,434,'dark_oak_planks');roof(193,429,43,15,34,2);
label(192,28,435,'木ノ葉隠れの里  KONOHAGAKURE');structures.push({id:'main_gate',kind:'gate',bounds:{from:[159,6,418],to:[225,42,439]},entrance:[192,7,434]});
// Stair access to wall walkways at two perimeter guardhouses.
for(const x of [31,351])for(let s=0;s<18;s++)box(x,7+s,399-s,x+2,7+s,399-s,'spruce_stairs[facing=north]');
}
function symbol(cx:number,cy:number,z:number,size:number){const points:number[][]=[];for(let i=0;i<=55;i++){const a=i/55*Math.PI*3.3,r=size*(.08+.8*i/55);points.push([Math.round(cx+r*Math.cos(a)),Math.round(cy+r*Math.sin(a))]);}for(let i=1;i<points.length;i++){const [a,c]=[points[i-1],points[i]],n=Math.max(1,Math.abs(c[0]-a[0])+Math.abs(c[1]-a[1]));for(let t=0;t<=n;t++)put(Math.round(a[0]+(c[0]-a[0])*t/n),Math.round(a[1]+(c[1]-a[1])*t/n),z,'green_terracotta');}
for(let t=0;t<=size;t++){put(cx+size+t,cy-size+Math.floor(t*.7),z,'green_terracotta');put(cx+size+t,cy+Math.floor(t*.3),z,'green_terracotta');}box(cx-size,cy-size,z,cx-size,cy,z,'green_terracotta');}
function hokage(){const cx=192,cz=151,R=27;flatten(160,118,225,184);for(let y=7;y<=65;y++)for(let x=cx-R;x<=cx+R;x++)for(let z=cz-R;z<=cz+R;z++){const r=Math.hypot(x-cx,z-cz);if(r>R)continue;if(r>R-1.4)put(x,y,z,(y%11<2)?'dark_oak_planks':'red_terracotta');if([17,28,39,50,61,65].includes(y))put(x,y,z,'spruce_planks');}
for(let y=66;y<=74;y++)for(let x=cx-30;x<=cx+30;x++)for(let z=cz-30;z<=cz+30;z++){const r=Math.hypot(x-cx,z-cz),rr=30-(y-66)*1.8;if(r<=rr&&r>rr-2)put(x,y,z,'bricks');}box(188,75,147,196,75,155,'bricks');
for(let f=0;f<6;f++){const y=7+f*11;for(const xx of [176,183,201,208])for(let dy=3;dy<=6;dy++)for(let z=cz+20;z<=cz+27;z++){if(vox.has(key(xx,y+dy,z)))put(xx,y+dy,z,'glass_pane');}
// A straight staircase and return corridor connect every administrative floor.
if(f<5)for(let s=1;s<=11;s++){const z=cz+13-s;cut(173,y+s,z,176,Math.min(64,y+13),z);box(173,y+s-1,z,176,y+s-1,z,'spruce_stairs[facing=north]');}
for(let xx=180;xx<=205;xx+=8){box(xx,y,cz-12,xx+3,y,cz-10,'dark_oak_planks');put(xx+1,y+1,cz-11,'lantern');}box(198,y,cz-19,208,y+3,cz-19,f===4?'bookshelf':'barrel');put(192,y+8,151,'sea_lantern');}
cut(188,7,176,196,12,179);line([[192,179],[192,192]],9,'sandstone');box(184,34,179,200,34,182,'spruce_planks');box(184,35,182,200,36,182,'oak_fence');
// Flat enamel panels carry the leaf emblem and the Fire kanji.
box(180,45,179,208,60,179,'white_terracotta');symbol(191,53,180,5);label(192,68,179,'火  HOKAGE');
structures.push({id:'hokage_complex',kind:'administrative',bounds:{from:[160,6,118],to:[225,75,184]},entrance:[192,7,178],interior:[192,7,151],stories:6,rooms:['vestibulo','oficinas','archivo','reuniones','oficina Hokage']});
}
function institutions(){building(70,308,49,35,4,3,'ninja_academy','academy');building(295,308,49,35,4,4,'konoha_hospital','hospital');
for(const [cx,cz,kind]of [[70,308,'academy'],[295,308,'hospital']] as const){for(let f=0;f<4;f++){const y=6+f*7;for(const xx of [cx-13,cx+12]){box(xx,y+1,cz-14,xx,y+5,cz+9,'white_terracotta');cut(xx,y+1,cz-1,xx,y+3,cz+1);}for(let j=0;j<3;j++)for(const s of [-1,1]){const x=cx+s*17,z=cz-10+j*7;if(kind==='academy'){box(x,y+1,z,x+2,y+1,z+1,'spruce_planks');put(x,y+1,z+2,'oak_stairs[facing=north]');box(cx-20,y+1,cz-15,cx-14,y+3,cz-15,'bookshelf');}else{put(x,y+1,z,'white_bed[part=foot,facing=north]');put(x,y+1,z-1,'white_bed[part=head,facing=north]');put(x+2,y+1,z,'barrel');}}}label(cx,31,cz+21,kind==='academy'?'忍  ACADEMIA NINJA':'HOSPITAL DE KONOHA');}
// Academy training courtyard and a hospital garden preserve separate identities.
flatten(42,332,99,345,6,'coarse_dirt');for(let x=47;x<97;x+=10)box(x,7,338,x,10,338,'oak_log');box(292,23,326,298,23,326,'red_terracotta');box(294,21,326,296,25,326,'red_terracotta');
}
function urban(){let count=0;
for(let row=0;row<3;row++)for(const cx of [44,77,110,143,243,276,309,342]){const cz=136+row*36;building(cx,cz,15+2*(count%4),15+2*((count+1)%3),2+(count%3),count%10,`residence_north_${count++}`);}
for(const cz of [350,382,413])for(const col of [121,152,244,277,310,341]){const cx=cz===413&&col===152?147:col;building(cx,cz,17+2*(count%3),17+2*(count%2),2+(count%2),count%10,`residence_south_${count++}`);}
for(const cx of [44,77,110,143,243,276,309,342]){building(cx,226,15,11,2,count++%10,`residence_lane_${cx}`);const side=cx===342?cx-13:cx+13;line([[cx,220],[side,220],[side,236]],3);}
for(const cx of [43,76,109,140,244,277,310,343]){if(cx===140)continue;building(cx,259,17+2*(count%2),17,2+(count%2),count%6,`commercial_market_${count++}`,'commercial');}
for(const cx of [120,151,244])building(cx,307,19,21,3,count++%6,`commercial_arcade_${cx}`,'commercial');
building(145,259,17,13,1,1,'ICHIRAKU RAMEN','commercial');cut(140,7,265,150,9,265);box(138,7,260,151,8,260,'stripped_spruce_wood');for(let x=140;x<=150;x+=2)put(x,7,263,'oak_stairs[facing=north]');box(139,7,255,141,7,255,'smoker');label(145,13,268,'一楽  ICHIRAKU RAMEN');
// Artisan and clan compounds, workshops and an archive expand the urban program.
for(const [x,z,v,n]of [[120,327,5,'artisan_workshop'],[151,327,8,'clan_library'],[244,327,6,'village_storage']] as const)building(x,z,15,11,2,v,n,'special');
building(209,307,13,17,3,0,'mission_archive','special');
// Plaza fountain, memorial, market stalls, benches and planted courtyards.
box(185,7,251,199,7,265,'stone_bricks');cut(187,7,253,197,7,263);box(187,7,253,197,7,263,'water');box(191,7,257,193,12,259,'stone_bricks');put(192,13,258,'chiseled_stone_bricks');
for(const x of [173,211])for(const z of [244,278])tree(x,z,13,1);
for(const z of [242,280])for(const x of [181,203])box(x,7,z,x+4,7,z,'spruce_stairs[facing=north]');
box(176,7,226,183,9,233,'stone_bricks');box(178,10,228,181,15,231,'polished_andesite');label(180,17,234,'Memorial de la Voluntad de Fuego');
for(let i=0;i<14;i++){const x=i<7?38+i*18:238+(i-7)*18,z=278;box(x,7,z,x+5,7,z+3,'barrel');for(const xx of [x,x+5])box(xx,8,z,xx,11,z+3,'oak_fence');box(x-1,12,z-1,x+6,12,z+4,i%2?'orange_wool':'white_wool');}
for(const z of [192,236,282,335,383,419])for(let x=36;x<=350;x+=23){if(Math.abs(x-192)<12)continue;lamp(x,z+5);}
for(let z=188;z<426;z+=19){lamp(183,z);lamp(202,z);}
for(const x of [61,94,127,259,292,325])for(const z of [150,186,222,345,383]){put(x+3,7,z,'flower_pot');put(x+4,7,z,'barrel');}
}
function trainingAndWater(){flatten(42,350,100,382,6,'coarse_dirt');flatten(42,387,101,415,6,'grass_block');for(let x=48;x<99;x+=10){box(x,7,357,x,11,357,'oak_log');put(x,11,358,'target');box(x,7,397,x+3,8,399,'oak_log');}tree(46,406,24,2);tree(95,409,21,0);label(72,13,351,'CAMPO DE ENTRENAMIENTO');structures.push({id:'training_grounds',kind:'training',bounds:{from:[42,6,350],to:[101,32,415]}});
// A lined, level canal uses source water and joins wooded pools.
for(let z=337;z<=418;z++){const x=220+Math.round(2*Math.sin(z/20));box(x-3,3,z,x+3,6,z,'stone_bricks');cut(x-2,4,z,x+2,6,z);box(x-2,4,z,x+2,5,z,'water');}
for(const z of [349,383,411]){box(210,7,z-2,230,7,z+2,'spruce_planks');box(210,8,z-2,230,9,z-2,'oak_fence');box(210,8,z+2,230,9,z+2,'oak_fence');lamp(210,z+3,7);lamp(230,z+3,7);structures.push({id:`bridge_${z}`,kind:'bridge'});}
}
function forest(){let planted=0;for(let n=0;n<1200;n++){const x=7+Math.floor(rand(n,1)*370),z=7+Math.floor(rand(n,2)*434);const outside=x<17||x>371||z>440||z<109&&(x<60||x>325);if(!outside||Math.abs(x-192)<19&&z>423)continue;let h=0;for(let y=0;y<=12;y++)if(vox.has(key(x,y,z)))h=y;if(h>10)continue;let clear=true;for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++)if(x+dx>=0&&x+dx<W&&z+dz>=0&&z+dz<D&&vox.has(key(x+dx,h+6,z+dz)))clear=false;if(!clear)continue;tree(x,z,13+Math.floor(rand(n,3)*16),n%5,h);planted++;}
// In-city ornamental trees occupy deliberate green pockets, not house plots.
for(const [x,z]of [[35,231],[352,234],[35,281],[352,282],[100,333],[265,333],[230,361],[234,403],[162,125],[225,125]])tree(x,z,14,2);
structures.push({id:'surrounding_forest',kind:'forest',trees:planted});
}
export function design(){terrain();phase='konoha_mountain';mountain();phase='konoha_streets';streets();phase='konoha_walls';walls();phase='konoha_center';hokage();phase='konoha_institutions';institutions();phase='konoha_districts';urban();phase='konoha_training_water';trainingAndWater();phase='konoha_forest';forest();phase='konoha_details';box(183,29,435,208,39,435,'white_terracotta');symbol(192,34,436,4);
// Covered grass is intentionally dirt so automatic grass decay cannot spoil counts.
for(const [k,b]of vox)if(b==='grass_block'){const [x,y,z]=k.split(',').map(Number);if(vox.has(key(x,y+1,z)))vox.set(k,'dirt');}
const residents=structures.filter(s=>s.kind==='residential').length,buildings=structures.filter(s=>s.entrance).length;if(residents<50||buildings<70)throw Error('Insufficient city density');
writeFileSync(new URL('../artifacts/konoha-design-summary.json', import.meta.url),JSON.stringify({dimensions:[W,D],urbanCore:[334,310],blocks:vox.size,buildings,residents,structures,labels,verifyAfterBuild:true,visualReview:false},null,2));
}



