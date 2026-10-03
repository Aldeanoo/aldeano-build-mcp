import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import {Vec3} from 'vec3';
import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import {compressVoxels} from '../../../src/build/executor/voxel-compressor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';

const {pathfinder}=pathfinderPkg;
type Voxels=Map<string,string>;
const key=(x:number,y:number,z:number)=>`${Math.round(x)},${Math.round(y)},${Math.round(z)}`;
function put(m:Voxels,x:number,y:number,z:number,b:string):void{m.set(key(x,y,z),b);}
function box(m:Voxels,x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,b:string):void{for(let y=Math.ceil(y1);y<=y2;y++)for(let z=Math.ceil(z1);z<=z2;z++)for(let x=Math.ceil(x1);x<=x2;x++)put(m,x,y,z,b);}
const AIR=new Set(['air','cave_air','void_air']);
const bots:mineflayer.Bot[]=[];
let origin:Vec3;
const H=new Map<string,number>();
function riverX(z:number):number{return Math.round(8*Math.sin(z*.045));}
function lakeR(x:number,z:number):number{return Math.sqrt((x/94)**2+((z-45)/64)**2);}
function height(x:number,z:number):number{
  const lk=lakeR(x,z);
  if(lk<.96)return Math.max(2,Math.round(2+12*Math.pow(lk,3)));
  if(z>86&&Math.abs(x-riverX(z))<10)return Math.max(0,Math.round(10-(z-86)*.23));
  if(z<-44&&z>-117&&Math.abs(x-riverX(z))<13)return 116;
  if(z<-44&&z>-120&&Math.abs(x)<25)return 125;
  if(z>=-44&&z<-20&&Math.abs(x)<23)return 18;
  const hills=105*Math.exp(-(((Math.abs(x)-107)/53)**2)-((z+55)/86)**2)+55*Math.exp(-(((Math.abs(x)-145)/31)**2)-((z-30)/95)**2);
  const rear=105*Math.exp(-(((z+102)/35)**2))*Math.exp(-((x/170)**4));
  const edge=Math.min(1,Math.max(0,(160-Math.abs(x))/18),Math.max(0,(128-Math.abs(z))/14));
  let h=Math.round((18+Math.max(hills,rear)+4*Math.sin(x*.09+z*.07)+3*Math.cos(z*.12-x*.025))*edge);
  for(const sx of [-78,78]){const d=Math.hypot(x-sx,z+49);if(d<27)h=Math.max(h,Math.round(123-(Math.max(0,d-18))*1.6));}
  return Math.max(0,Math.min(145,h));
}
function terrain():Voxels{
  const m:Voxels=new Map();
  for(let x=-160;x<=160;x++)for(let z=-128;z<=128;z++)H.set(`${x},${z}`,height(x,z));
  for(let x=-160;x<=160;x++)for(let z=-128;z<=128;z++){
    const h=H.get(`${x},${z}`)!;const low=Math.max(0,Math.min(h-3,...[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>(H.get(`${x+dx},${z+dz}`)??0)-2)));
    const wet=lakeR(x,z)<.98||(z>85&&Math.abs(x-riverX(z))<12)||(z<-44&&z>-117&&Math.abs(x-riverX(z))<13);
    const steep=h-low>7;
    const strata=['stone','stone','andesite','tuff','stone','cobblestone'];
    for(let y=low;y<=h;y++){
      const band=Math.abs(Math.floor(x/12)+Math.floor(z/14)+Math.floor(y/11))%strata.length;
      const b=y===h&&!wet&&!steep?'grass_block':y>=h-2&&!wet&&!steep?'dirt':wet&&y===h?'gravel':y<8?'deepslate':strata[band];put(m,x,y,z,b);
    }
    if((x%32===0&&z%32===0)&&h>12)box(m,x-1,0,z-1,x+1,h,z+1,'stone');
  }
  // Riverbed lip and stepped rock impacts behind the waterfall.
  box(m,-22,112,-47,22,115,-44,'stone');
  box(m,-20,81,-46,20,84,-37,'andesite');
  box(m,-24,49,-46,24,52,-31,'stone');
  box(m,-26,22,-46,26,25,-23,'tuff');
  return m;
}
interface Ring{y:number;a:number;b:number;ra:number;rb:number}
function loft(m:Voxels,rings:Ring[],material:string):void{for(let i=0;i<rings.length-1;i++){const l=rings[i],r=rings[i+1];for(let y=l.y;y<=r.y;y++){const t=(y-l.y)/(r.y-l.y),a=l.a+(r.a-l.a)*t,b=l.b+(r.b-l.b)*t,ra=l.ra+(r.ra-l.ra)*t,rb=l.rb+(r.rb-l.rb)*t;for(let da=-Math.ceil(ra);da<=ra;da++)for(let db=-Math.ceil(rb);db<=rb;db++)if((da/ra)**2+(db/rb)**2<=1.07)put(m,a+da,y,b+db,material);}}}
function tube(m:Voxels,a:Vec3,b:Vec3,r:number,material:string):void{const steps=Math.ceil(a.distanceTo(b)*2);for(let i=0;i<=steps;i++){const p=a.plus(b.minus(a).scaled(i/steps));for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++)for(let dz=-r;dz<=r;dz++)if(dx*dx+dy*dy+dz*dz<=r*r)put(m,p.x+dx,p.y+dy,p.z+dz,material);}}
function statue(madara:boolean):Voxels{
  const m:Voxels=new Map(),armor=madara?'stone_bricks':'polished_andesite',hair=madara?'deepslate_bricks':'andesite';
  for(const side of [-1,1]){
    loft(m,[{y:0,a:side*10,b:8,ra:9,rb:14},{y:7,a:side*10,b:5,ra:8,rb:12},{y:12,a:side*10,b:0,ra:7,rb:7}], 'stone');
    loft(m,[{y:8,a:side*10,b:0,ra:7,rb:7},{y:24,a:side*10,b:0,ra:8,rb:8},{y:39,a:side*10,b:0,ra:7,rb:7},{y:59,a:side*10,b:0,ra:10,rb:9},{y:64,a:side*9,b:0,ra:10,rb:10}], 'stone');
    box(m,side*10-5,35,6,side*10+5,42,9,'polished_andesite');
    for(let y=12;y<32;y+=5)box(m,side*10-5,y,7,side*10+5,y+1,8,'stone_bricks');
  }
  loft(m,[{y:57,a:0,b:0,ra:19,rb:11},{y:68,a:0,b:0,ra:17,rb:11},{y:77,a:0,b:0,ra:14,rb:10},{y:95,a:0,b:0,ra:19,rb:12},{y:106,a:0,b:0,ra:18,rb:11},{y:112,a:0,b:0,ra:8,rb:7}], 'stone');
  // Layered samurai chest and skirt lamellae have relief rather than painted markings.
  for(let y=63;y<=104;y+=6){const w=y<78?20:16;box(m,-w,y,9,w,y+3,13,armor);box(m,-w,y+4,10,w,y+4,12,'cracked_stone_bricks');}
  for(const side of [-1,1]){
    loft(m,[{y:96,a:side*21,b:0,ra:8,rb:10},{y:108,a:side*22,b:0,ra:10,rb:10},{y:114,a:side*19,b:0,ra:6,rb:8}],armor);
    for(let y=98;y<=110;y+=4)box(m,side===-1?-29:15,y,7,side===-1?-15:29,y+1,10,'stone_bricks');
  }
  tube(m,new Vec3(-21,100,0),new Vec3(-23,81,8),7,'stone');
  tube(m,new Vec3(-23,81,8),new Vec3(-9,96,20),6,'stone');
  tube(m,new Vec3(21,100,0),new Vec3(24,84,9),7,'stone');
  tube(m,new Vec3(24,84,9),new Vec3(8,105,22),6,'stone');
  box(m,-14,94,17,-5,104,24,'polished_andesite');
  box(m,4,102,18,12,112,25,'polished_andesite');
  for(let a=5;a<=11;a+=3)box(m,a,110,21,a+1,122,23,'polished_andesite');
  for(let a=-13;a<=-7;a+=3)box(m,a,95,24,a+1,101,25,'andesite');
  loft(m,[{y:110,a:0,b:0,ra:7,rb:7},{y:119,a:0,b:1,ra:7,rb:7}], 'stone');
  loft(m,[{y:116,a:0,b:1,ra:6,rb:8},{y:123,a:0,b:1,ra:10,rb:10},{y:137,a:0,b:0,ra:11,rb:10},{y:145,a:0,b:-1,ra:8,rb:9}], 'polished_diorite');
  box(m,-1,126,10,1,136,15,'polished_diorite');
  box(m,-4,123,10,4,124,12,'andesite');
  for(const side of [-1,1]){box(m,side===-1?-8:3,136,9,side===-1?-3:8,137,11,'andesite');box(m,side===-1?-7:3,132,10,side===-1?-3:7,134,12,'gray_stained_glass');box(m,side*11,127,-1,side*11,135,3,'polished_diorite');}
  if(madara){
    loft(m,[{y:124,a:0,b:-7,ra:12,rb:7},{y:140,a:0,b:-5,ra:14,rb:10},{y:147,a:0,b:-4,ra:10,rb:8}],hair);
    for(let i=0;i<11;i++){const angle=i*Math.PI*2/11;const a=Math.cos(angle)*12,b=-6+Math.sin(angle)*7;const tip=new Vec3(a*1.5,137+(i%4)*5,b-5-(i%3)*2);tube(m,new Vec3(a,135,b),tip,3,hair);put(m,tip.x,tip.y+2,tip.z,hair);}
    tube(m,new Vec3(-7,142,5),new Vec3(-5,128,12),3,hair);
    for(let a=-9;a<=9;a+=4)tube(m,new Vec3(a,136,-10),new Vec3(a*1.3,109,-13),3,hair);
  }else{
    loft(m,[{y:134,a:0,b:-3,ra:11,rb:10},{y:146,a:0,b:-3,ra:9,rb:8},{y:150,a:0,b:-3,ra:6,rb:6}],hair);
    box(m,-11,106,-11,11,139,-7,hair);
    for(const a of [-10,-7,7,10])tube(m,new Vec3(a,140,-3),new Vec3(a,115,0),2,hair);
    box(m,-10,138,8,10,140,11,'smooth_stone');
    box(m,-2,139,12,2,139,12,'andesite');box(m,0,137,12,0,141,12,'andesite');put(m,3,140,12,'andesite');
  }
  // Two-block skin removes solid fill while preserving all outer details.
  const filled=new Set(m.keys());const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const k of filled){const [a,y,b]=k.split(',').map(Number);if(directions.every(([da,dy,db])=>[1,2].every(d=>filled.has(key(a+da*d,y+dy*d,b+db*d)))))m.delete(k);}
  // Internal floors, continuous two-part spiral and accessible shoulder galleries.
  box(m,-13,2,-3,-7,63,3,'air');box(m,-3,64,-3,3,144,3,'air');
  box(m,-14,1,-6,-6,1,7,'smooth_stone');
  for(const y of [17,33,49])box(m,-13,y,-5,-7,y,5,'smooth_stone');
  for(const y of [64,80,96,108])box(m,-12,y,-6,12,y,6,'smooth_stone');
  for(const y of [124,131,140])box(m,-6,y,-5,6,y,6,'smooth_stone');
  function spiral(center:number,start:number,end:number):void{
    const path:Array<[number,number]>=[];for(let a=-2;a<2;a++)path.push([a,-2]);for(let b=-2;b<2;b++)path.push([2,b]);for(let a=2;a>-2;a--)path.push([a,2]);for(let b=2;b>-2;b--)path.push([-2,b]);
    for(let y=start;y<=end;y++){const [a,b]=path[(y-start)%path.length];put(m,a+center,y,b,'stone_brick_stairs');put(m,center,y,0,'stone_bricks');for(let head=1;head<=3;head++)put(m,a+center,y+head,b,'air');}
  }
  spiral(-10,2,64);spiral(0,65,141);
  box(m,-12,65,-1,2,68,1,'air');box(m,-12,64,-1,2,64,1,'smooth_stone');
  for(const side of [-1,1]){box(m,side===-1?-23:3,106,-2,side===-1?-3:23,109,2,'air');box(m,side===-1?-23:3,105,-2,side===-1?-3:23,105,2,'smooth_stone');}
  box(m,-5,132,3,5,136,9,'air');
  for(const side of [-1,1]){box(m,side===-1?-7:3,132,9,side===-1?-3:7,134,12,'gray_stained_glass');}
  // Door and rear access passage through the left foot.
  box(m,-12,2,-18,-8,6,0,'air');box(m,-12,1,-18,-8,1,0,'stone_bricks');
  box(m,-13,2,0,-13,64,0,'stone_bricks');box(m,3,64,0,3,144,0,'stone_bricks');
  for(const y of [10,28,46,67,83,99,115,135])put(m,y<65?-12:3,y,0,'sea_lantern');
  const result:Voxels=new Map();const face=madara?-1:1,sx=madara?78:-78;
  for(const [k,b]of m){const [a,y,f]=k.split(',').map(Number);let material=b;if(b==='stone_brick_stairs'){
    // Determine the next stair around the spiral in global coordinates.
    const center=y<65?-10:0;const da=a-center,db=f;
    const dir=db===-2&&da<2?[1,0]:da===2&&db<2?[0,1]:db===2&&da>-2?[-1,0]:[0,-1];
    const dx=face*dir[1],dz=dir[0];material=`stone_brick_stairs[facing=${dx>0?'east':dx<0?'west':dz>0?'south':'north'}]`;
  }put(result,sx+face*f,126+y,-49+a,material);}
  box(result,sx-23,122,-73,sx+23,125,-25,'stone_bricks');
  // Entrance path from the cliff top to the opened foot.
  const rearX=sx-face*18;
  box(result,Math.min(rearX,sx-face*26),127,-61,Math.max(rearX,sx-face*26),132,-57,'air');
  box(result,Math.min(rearX,sx-face*26),126,-61,Math.max(rearX,sx-face*26),126,-57,'stone_bricks');
  return result;
}
function water():Voxels{
  const m:Voxels=new Map();
  for(let x=-100;x<=100;x++)for(let z=-18;z<=115;z++)if(lakeR(x,z)<.96){const h=height(x,z);box(m,x,h+1,z,x,18,z,'water');}
  for(let z=87;z<=126;z++){const level=Math.max(1,Math.round(18-(z-87)*.4));for(let x=riverX(z)-8;x<=riverX(z)+8;x++)box(m,x,height(x,z)+1,z,x,level,z,'water');}
  for(let z=-114;z<=-44;z++)for(let x=riverX(z)-11;x<=riverX(z)+11;x++)box(m,x,117,z,x,121,z,'water');
  // Only source lips are placed; the waterfall flows over three irregular shelves.
  box(m,-15,121,-44,15,121,-40,'water');
  box(m,-14,85,-40,14,85,-36,'water');box(m,-18,53,-35,18,53,-30,'water');box(m,-21,26,-28,21,26,-22,'water');
  for(let x=-22;x<=22;x+=4){put(m,x,19,-17,'white_stained_glass');put(m,x+1,19,-15,'calcite');}
  return m;
}
function paths():Voxels{
  const m:Voxels=new Map();
  for(const side of [-1,1]){
    for(let i=0;i<=106;i++){const x=side*Math.round(105+12*Math.sin(i*.075)),z=80-i,y=18+i;
      box(m,x-2,y+1,z-1,x+2,y+4,z+1,'air');box(m,x-2,y,z,x+2,y,z,'stone_brick_stairs[facing=north]');
      if(i%12===0)box(m,x-1,Math.min(height(x,z),y),z,x+1,y-1,z,'stone_bricks');
    }
    box(m,side===-1?-126:78,124,-49,side===-1?-78:126,124,-26,'stone_bricks');
    box(m,side===-1?-126:105,125,-49,side===-1?-105:126,128,-26,'air');
    box(m,side===-1?-106:99,125,-49,side===-1?-99:106,127,-26,'air');
    for(const step of [0,1])box(m,side*(105-step),125+step,-61,side*(105-step),125+step,-57,`stone_brick_stairs[facing=${side===-1?'east':'west'}]`);
    for(let z=-20;z<110;z++){const x=side*Math.round(97+4*Math.sin(z*.08));const y=height(x,z);box(m,x-2,y,z-1,x+2,y,z+1,'gravel');}
  }
  // Pedestrian bridge downstream; narrow footpaths make statue scale legible.
  box(m,-21,20,94,21,20,97,'spruce_planks');
  for(const x of [-20,20])box(m,x,0,94,x+1,22,97,'stripped_spruce_log');
  box(m,-21,21,94,21,22,94,'spruce_fence');box(m,-21,21,97,21,22,97,'spruce_fence');
  return m;
}
function forest():Voxels{
  const m:Voxels=new Map();let trees=0;
  for(let x=-148;x<=148;x+=10)for(let z=-116;z<=116;z+=10){
    const noise=Math.sin(x*.31+z*.47)+Math.cos(x*.14-z*.22);const px=x+Math.round(Math.sin(z)*3),pz=z+Math.round(Math.cos(x)*3);
    if(noise<-.5||lakeR(px,pz)<1.1||Math.abs(px)<33&&pz<-18||[-78,78].some(s=>Math.hypot(px-s,pz+49)<40))continue;
    const h=height(px,pz);if(h<8||h>140)continue;const tall=10+Math.abs(Math.round(Math.sin(px+pz)*9));
    box(m,px-1,h+1,pz-1,px+1,h+tall,pz+1,'oak_log');
    for(let dy=-5;dy<=5;dy++)for(let dx=-6;dx<=6;dx++)for(let dz=-6;dz<=6;dz++)if(dx*dx+dz*dz+dy*dy*1.7<=36)put(m,px+dx,h+tall+dy,pz+dz,'oak_leaves[persistent=true]');
    if(trees%3===0)tube(m,new Vec3(px,h+tall-7,pz),new Vec3(px+5,h+tall-3,pz+2),1,'oak_log');
    trees++;
  }
  for(let x=-145;x<=145;x+=13)for(let z=-105;z<=115;z+=19)if(lakeR(x,z)>1.02&&Math.sin(x+z)>0){const y=height(x,z);box(m,x-2,y+1,z-2,x+2,y+2,z+2,'moss_block');put(m,x,y+3,z,'oak_leaves[persistent=true]');}
  console.log(JSON.stringify({stage:'forest-designed',trees}));return m;
}
async function spawn(name:string):Promise<mineflayer.Bot>{const bot=mineflayer.createBot({host:'127.0.0.1',port:9999,username:name,plugins:{pathfinder}});bots.push(bot);await new Promise<void>((resolve,reject)=>{bot.once('spawn',resolve);bot.once('error',reject);bot.once('end',()=>reject(new Error(`${name} disconnected`)));bot.once('kicked',r=>reject(new Error(String(r))));});await bot.waitForChunksToLoad();return bot;}
async function fly(bot:mineflayer.Bot,target:Vec3):Promise<void>{
  await new BoundedTeleportService(bot).selfTo(target.floored());
}
async function positionWorker(bot:mineflayer.Bot,x:number,z:number):Promise<void>{
  await new BoundedTeleportService(bot).selfTo(origin.offset(x,305,z).floored());
}
interface Tile{x1:number;x2:number;z1:number;z2:number}
const tiles:Tile[]=[];for(let ix=0;ix<3;ix++)for(let iz=0;iz<3;iz++)tiles.push({x1:-160+ix*107,x2:-160+ix*107+106,z1:-128+iz*86,z2:Math.min(128,-128+iz*86+85)});
async function preflight(bot:mineflayer.Bot):Promise<void>{
  for(let index=0;index<tiles.length;index++){
    const t=tiles[index],cx=Math.floor((t.x1+t.x2)/2),cz=Math.floor((t.z1+t.z2)/2);
    await fly(bot,origin.offset(cx,2,cz));let unreadable=0,occupied=0;
    for(let x=t.x1;x<=t.x2;x++)for(let z=t.z1;z<=t.z2;z++)for(let y=0;y<=307;y++){const b=bot.blockAt(origin.offset(x,y,z));if(!b)unreadable++;else if(!AIR.has(b.name))occupied++;}
    console.log(JSON.stringify({stage:'site-preflight',section:index+1,total:9,occupied,unreadable}));
    if(occupied||unreadable)throw new Error('Construction site is not empty or fully loaded');
  }
}
function clipped(ops:FastCommandOperation[],tile:Tile):FastCommandOperation[]{const result:FastCommandOperation[]=[];for(const op of ops){if(op.type!=='fill')continue;const x1=Math.max(op.from.x,origin.x+tile.x1),x2=Math.min(op.to.x,origin.x+tile.x2),z1=Math.max(op.from.z,origin.z+tile.z1),z2=Math.min(op.to.z,origin.z+tile.z2);if(x1<=x2&&z1<=z2)result.push({...op,from:{...op.from,x:x1,z:z1},to:{...op.to,x:x2,z:z2}});}return result;}
const expectedFinal:Voxels=new Map();
const phases:Array<{name:string;commands:number;voxels:number}>=[];
async function phase(name:string,generate:()=>Voxels):Promise<void>{
  const voxels=generate(),count=voxels.size,ops=compressVoxels(voxels,origin);for(const [key,block]of voxels)expectedFinal.set(key,block);voxels.clear();
  console.log(JSON.stringify({stage:'phase-start',name,voxels:count,commands:ops.length}));
  let cursor=0,submitted=0;
  const outcomes=await Promise.allSettled(bots.map(async bot=>{for(;;){const index=cursor++;if(index>=tiles.length)return;const tile=tiles[index],part=clipped(ops,tile);if(!part.length)continue;await positionWorker(bot,Math.floor((tile.x1+tile.x2)/2),Math.floor((tile.z1+tile.z2)/2));const result=await new ParallelFastExecutor([bot]).execute(part,{commandsPerTick:3});submitted+=result.submittedCommands;console.log(JSON.stringify({stage:'section-submitted',phase:name,worker:bot.username,section:index+1,commands:result.submittedCommands}));}}));
  for(const result of outcomes)if(result.status==='rejected')throw result.reason;
  phases.push({name,commands:submitted,voxels:count});writeFileSync(new URL('../artifacts/final-valley-progress.json', import.meta.url),JSON.stringify({origin,phases,verifyAfterBuild:true,visualReview:false},null,2));console.log(JSON.stringify({stage:'phase-submitted',name,commands:submitted}));
}
async function run():Promise<void>{
  const leader=await spawn('ValleyLead');await fly(leader,new Vec3(leader.entity.position.x,270,leader.entity.position.z));await fly(leader,new Vec3(1100,270,400));
  let ground:number|undefined;for(let y=269;y>=-64;y--){const b=leader.blockAt(new Vec3(1100,y,400));if(!b)throw new Error('Site chunk unavailable');if(!AIR.has(b.name)){ground=y;break;}}
  if(ground===undefined||ground+308>319)throw new Error('Insufficient vertical space');origin=new Vec3(1100,ground+1,400);
  console.log(JSON.stringify({stage:'site',origin,dimensions:[321,308,257],statueHeight:155,waterfallDrop:103,lakeWidth:188}));
  await fly(leader,origin.offset(0,2,0));await preflight(leader);
  const outcomes=await Promise.allSettled([1,2,3].map(i=>spawn(`ValleyWork${i}`)));for(const result of outcomes)if(result.status==='rejected')throw result.reason;
  await phase('mountains-cliffs-lakebed',terrain);
  await phase('Hashirama-hollow-interior',()=>statue(false));
  await phase('Madara-hollow-interior',()=>statue(true));
  await phase('paths-stairways-bridge',paths);
  await phase('clustered-forest',forest);
  await phase('river-lake-cascades',water);
  const verified=await finalizeVoxels(leader,expectedFinal,origin,{mode:'fast'});
  const report={status:'completed',verifiedBlocks:verified.correct,expectedBlocks:verified.expected,origin,bounds:{from:origin.offset(-160,0,-128),to:origin.offset(160,307,128)},sceneDimensions:[321,308,257],statuesHollow:true,statueHeight:155,phases,verifyAfterBuild:true,visualReview:false};
  writeFileSync(new URL('../artifacts/final-valley-result.json', import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const bot of bots)bot.quit();process.exit(process.exitCode??0);});
