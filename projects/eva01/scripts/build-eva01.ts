import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';
import { ParallelFastExecutor } from '../../../src/build/executor/parallel-fast-executor.js';
import { BuildPreflight } from '../../../src/build/verification/build-preflight.js';

const { pathfinder } = pathfinderPkg;
const world = new Map<string,string>();
const P='purple_concrete', D='black_concrete', G='lime_concrete', S='gray_concrete';
const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const put=(x:number,y:number,z:number,b:string)=>world.set(key(Math.round(x),Math.round(y),Math.round(z)),b);
function box(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,b:string):void {
  for(let y=Math.ceil(y1);y<=y2;y++)for(let z=Math.ceil(z1);z<=z2;z++)for(let x=Math.ceil(x1);x<=x2;x++)put(x,y,z,b);
}
interface Ring {y:number;x:number;z:number;rx:number;rz:number}
function loft(rings:Ring[],material=P):void {
  for(let i=0;i<rings.length-1;i++){
    const a=rings[i],b=rings[i+1];
    for(let y=a.y;y<=b.y;y++){
      const t=(y-a.y)/(b.y-a.y),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,rx=a.rx+(b.rx-a.rx)*t,rz=a.rz+(b.rz-a.rz)*t;
      for(let dx=-Math.ceil(rx);dx<=rx;dx++)for(let dz=-Math.ceil(rz);dz<=rz;dz++)if(Math.abs(dx/rx)**2.8+Math.abs(dz/rz)**2.8<=1)put(x+dx,y,z+dz,material);
    }
  }
}
function tube(a:Vec3,b:Vec3,rx:number,rz:number,material:string):void {
  const steps=Math.ceil(a.distanceTo(b)*2);
  for(let i=0;i<=steps;i++){
    const p=a.plus(b.minus(a).scaled(i/steps));
    for(let x=-rx;x<=rx;x++)for(let y=-rx;y<=rx;y++)for(let z=-rz;z<=rz;z++)if((x/rx)**2+(y/rx)**2+(z/rz)**2<=1)put(p.x+x,p.y+y,p.z+z,material);
  }
}
function design():void {
  // Reinforced launch pad; the EVA itself is entirely filled.
  box(-50,0,-41,50,2,41,'polished_deepslate');
  box(-47,3,-38,47,3,38,'smooth_stone');
  box(-43,4,-34,43,4,34,D);
  for(const x of [-46,46])box(x,4,-38,x,4,38,G);
  for(const z of [-37,37])box(-46,4,z,46,4,z,G);
  for(let x=-40;x<=40;x+=8){box(x,4,-38,x+3,4,-36,'yellow_concrete');box(x,4,36,x+3,4,38,'yellow_concrete');}
  for(const side of [-1,1]) {
    const x=side*17,z=side===-1?-13:7;
    // Long armored feet and segmented soles.
    loft([{y:5,x,z:z-6,rx:10,rz:18},{y:8,x,z:z-6,rx:10,rz:18},{y:14,x,z:z-1,rx:7,rz:11}],D);
    loft([{y:9,x,z:z-7,rx:9,rz:16},{y:16,x,z,rx:6,rz:7}],P);
    box(x-5,9,z-23,x+5,11,z-22,G);
    box(x-2,12,z-21,x+2,13,z-17,'gray_concrete');
    for(let dz=-18;dz<=8;dz+=7)box(x-9,7,z+dz,x+9,7,z+dz,S);
    const kneeX=side===-1?-13:18,kneeZ=side===-1?-5:10,kneeY=side===-1?54:51;
    loft([{y:15,x,z,rx:5,rz:6},{y:26,x:side*19,z,rx:7,rz:7},{y:42,x:kneeX,z:kneeZ,rx:6,rz:6},{y:kneeY,x:kneeX,z:kneeZ,rx:6,rz:7}],D);
    loft([{y:18,x,z:z-1,rx:5,rz:6},{y:30,x:side*19,z:z-2,rx:7,rz:7},{y:46,x:kneeX,z:kneeZ-1,rx:6,rz:6}],P);
    tube(new Vec3(x,20,z-6),new Vec3(kneeX,45,kneeZ-6),2,1,G);
    // Oversized knee caps with layered green borders.
    box(kneeX-6,kneeY-3,kneeZ-9,kneeX+6,kneeY+6,kneeZ-7,G);
    box(kneeX-4,kneeY-1,kneeZ-10,kneeX+4,kneeY+5,kneeZ-9,P);
    box(kneeX-2,kneeY+1,kneeZ-11,kneeX+2,kneeY+4,kneeZ-10,D);
    loft([{y:kneeY+3,x:kneeX,z:kneeZ,rx:6,rz:7},{y:72,x:side*13,z:3,rx:9,rz:8},{y:88,x:side*10,z:3,rx:8,rz:8}],P);
    tube(new Vec3(kneeX+side*6,kneeY+7,kneeZ),new Vec3(side*17,77,4),2,2,D);
    box(side===-1?-20:17,72,1,side===-1?-17:20,82,7,G);
    for(let y=62;y<=80;y+=6)box(side*13-5,y,-6,side*13+5,y,-6,'purple_terracotta');
  }
  // Pelvis and narrow segmented abdominal armor.
  loft([{y:84,x:0,z:3,rx:15,rz:10},{y:90,x:0,z:2,rx:17,rz:10},{y:96,x:0,z:0,rx:10,rz:8}],D);
  for(const side of [-1,1])loft([{y:86,x:side*10,z:-3,rx:6,rz:7},{y:94,x:side*9,z:-3,rx:7,rz:6}],P);
  loft([{y:94,x:0,z:0,rx:10,rz:8},{y:105,x:0,z:-2,rx:11,rz:9},{y:115,x:0,z:-4,rx:13,rz:10}],D);
  for(let y=96;y<=111;y+=5){box(-8,y,-12,8,y+2,-10,P);box(-6,y+3,-12,6,y+3,-11,'gray_concrete');}
  box(-2,96,-13,2,113,-12,G);
  // Swept chest, paired armor plates and angular chest chevrons.
  loft([{y:110,x:0,z:-3,rx:12,rz:10},{y:121,x:0,z:-5,rx:19,rz:12},{y:132,x:0,z:-5,rx:19,rz:10},{y:138,x:0,z:-5,rx:13,rz:8}],P);
  for(const side of [-1,1]){
    tube(new Vec3(side*3,120,-17),new Vec3(side*16,132,-13),2,2,D);
    tube(new Vec3(side*4,123,-18),new Vec3(side*16,135,-13),1,1,G);
    box(side===-1?-17:13,118,-16,side===-1?-13:17,126,-15,'purple_terracotta');
    for(let y=117;y<=130;y+=4)box(side===-1?-14:8,y,7,side===-1?-8:14,y+1,9,S);
  }
  box(-4,117,-17,4,120,-15,'red_concrete');
  box(-2,118,-18,2,119,-17,'redstone_block');
  // Spine, back vents and orange neck collar.
  box(-3,94,8,3,133,11,D);
  for(let y=101;y<=131;y+=5)box(-4,y,11,4,y+1,12,G);
  loft([{y:136,x:0,z:-5,rx:7,rz:6},{y:143,x:0,z:-8,rx:6,rz:6}],D);
  box(-8,136,-13,8,139,-11,'orange_concrete');
  box(-6,138,-14,6,140,-13,'yellow_concrete');
  // Shoulder binders: tall angular fins, not spherical shoulders.
  for(const side of [-1,1]){
    loft([{y:123,x:side*23,z:-1,rx:7,rz:8},{y:137,x:side*27,z:-2,rx:8,rz:9},{y:150,x:side*26,z:-3,rx:6,rz:7},{y:156,x:side*24,z:-4,rx:3,rz:4}],P);
    box(side===-1?-32:29,133,-7,side===-1?-29:32,149,1,D);
    box(side===-1?-29:26,143,-9,side===-1?-26:29,154,-8,G);
    box(side===-1?-30:27,128,-11,side===-1?-27:30,136,-10,G);
    for(let y=133;y<=143;y+=4)box(side===-1?-30:27,y,-11,side===-1?-27:30,y+1,-10,S);
  }
  // Left arm lowered aggressively, right arm raised across the front in guard.
  tube(new Vec3(-24,128,-1),new Vec3(-34,108,-3),6,6,D);
  tube(new Vec3(-26,126,-2),new Vec3(-34,111,-4),5,5,P);
  tube(new Vec3(-34,108,-3),new Vec3(-40,86,-17),7,7,P);
  tube(new Vec3(-40,87,-23),new Vec3(-34,107,-9),2,1,G);
  box(-47,83,-19,-35,87,-15,G);
  loft([{y:77,x:-41,z:-18,rx:6,rz:6},{y:87,x:-41,z:-17,rx:7,rz:6}],D);
  for(let x=-46;x<=-37;x+=3)box(x,78,-25,x+1,84,-24,S);
  tube(new Vec3(24,128,-1),new Vec3(36,108,-4),6,6,D);
  tube(new Vec3(25,126,-2),new Vec3(35,112,-5),5,5,P);
  tube(new Vec3(36,108,-4),new Vec3(30,126,-26),7,7,P);
  tube(new Vec3(38,112,-12),new Vec3(32,123,-27),2,2,G);
  box(24,124,-29,36,127,-25,G);
  loft([{y:125,x:30,z:-28,rx:6,rz:6},{y:137,x:29,z:-29,rx:6,rz:6}],D);
  for(let x=25;x<=33;x+=3)box(x,129,-36,x+1,135,-35,S);
  // Predatory Unit-01 helmet: forward-set jaw, brow, cheek fins and horn.
  loft([{y:142,x:0,z:-10,rx:6,rz:7},{y:149,x:0,z:-11,rx:10,rz:10},{y:158,x:0,z:-9,rx:10,rz:9},{y:166,x:0,z:-7,rx:6,rz:7}],P);
  loft([{y:142,x:0,z:-15,rx:4,rz:6},{y:149,x:0,z:-17,rx:7,rz:5},{y:153,x:0,z:-16,rx:7,rz:5}],D);
  box(-5,145,-23,5,146,-22,S);
  box(-3,142,-21,3,144,-19,S);
  for(const side of [-1,1]){
    tube(new Vec3(side*7,147,-17),new Vec3(side*10,156,-14),2,2,G);
    tube(new Vec3(side*9,150,-8),new Vec3(side*12,168,-3),2,2,P);
    tube(new Vec3(side*9,154,-19),new Vec3(side*3,158,-21),2,1,D);
    tube(new Vec3(side*8,155,-20),new Vec3(side*3,157,-22),1,1,'sea_lantern');
    tube(new Vec3(side*8,154,-21),new Vec3(side*3,156,-23),1,1,G);
    box(side===-1?-9:7,159,-12,side===-1?-7:9,165,-10,D);
  }
  // A single pronounced forehead horn inclines forwards above the face.
  loft([{y:158,x:0,z:-17,rx:3,rz:4},{y:166,x:0,z:-21,rx:3,rz:4},{y:177,x:0,z:-28,rx:2,rz:3},{y:185,x:0,z:-32,rx:1,rz:1}],P);
  tube(new Vec3(0,162,-22),new Vec3(0,183,-34),1,1,G);
  box(-2,152,-23,2,155,-21,P);
  box(-1,153,-24,1,154,-23,S);
  // Rear umbilical socket; restrained industrial accents on the launch pad.
  box(-4,108,12,4,116,15,'polished_blackstone');
  box(-2,110,16,2,114,17,'orange_concrete');
  for(const x of [-43,43])for(const z of [-34,34]){box(x-1,4,z-1,x+1,5,z+1,'sea_lantern');box(x-1,6,z-1,x+1,6,z+1,'lime_stained_glass');}
}
function commands(origin:Vec3):FastCommandOperation[] {
  const rows=new Map<string,Array<{x:number;block:string}>>();
  for(const [k,block]of world){const [x,y,z]=k.split(',').map(Number);const rk=`${y},${z}`;const row=rows.get(rk)??[];row.push({x,block});rows.set(rk,row);}
  const vertical=new Map<string,Array<Extract<FastCommandOperation,{type:'fill'}>>>();
  for(const [rk,row]of rows){const [y,z]=rk.split(',').map(Number);row.sort((a,b)=>a.x-b.x);for(let i=0;i<row.length;){let j=i;while(j+1<row.length&&row[j+1].x===row[j].x+1&&row[j+1].block===row[i].block)j++;const op:Extract<FastCommandOperation,{type:'fill'}>={type:'fill',from:{x:origin.x+row[i].x,y:origin.y+y,z:origin.z+z},to:{x:origin.x+row[j].x,y:origin.y+y,z:origin.z+z},block:row[i].block};const g=`${op.from.x},${op.to.x},${op.from.z},${op.block}`;const list=vertical.get(g)??[];list.push(op);vertical.set(g,list);i=j+1;}}
  const depth=new Map<string,Array<Extract<FastCommandOperation,{type:'fill'}>>>();
  for(const listof of vertical.values()){listof.sort((a,b)=>a.from.y-b.from.y);let current=listof[0];const save=()=>{const k=`${current.from.x},${current.to.x},${current.from.y},${current.to.y},${current.block}`;const group=depth.get(k)??[];group.push(current);depth.set(k,group);};for(let i=1;i<listof.length;i++){if(listof[i].from.y===current.to.y+1)current={...current,to:{...current.to,y:listof[i].to.y}};else{save();current=listof[i];}}save();}
  const out:FastCommandOperation[]=[];
  for(const list of depth.values()){list.sort((a,b)=>a.from.z-b.from.z);let current=list[0];for(let i=1;i<list.length;i++){const next=list[i];const volume=(current.to.x-current.from.x+1)*(current.to.y-current.from.y+1)*(next.to.z-current.from.z+1);if(next.from.z===current.to.z+1&&volume<=32768)current={...current,to:{...current.to,z:next.to.z}};else{out.push(current);current=next;}}out.push(current);}
  return out.sort((a,b)=>(a.type==='fill'?a.from.y:a.position.y)-(b.type==='fill'?b.from.y:b.position.y));
}
function connect(name:string):mineflayer.Bot{return mineflayer.createBot({host:'127.0.0.1',port:9999,username:name,plugins:{pathfinder}});}
async function spawned(bot:mineflayer.Bot):Promise<void>{await new Promise<void>((resolve,reject)=>{bot.once('spawn',resolve);bot.once('error',reject);bot.once('end',()=>reject(new Error('Disconnected')));bot.once('kicked',r=>reject(new Error(String(r))));});await bot.waitForChunksToLoad();}
async function fly(bot:mineflayer.Bot,target:Vec3):Promise<void>{
  await new BoundedTeleportService(bot).selfTo(target.floored());
}
const bots:mineflayer.Bot[]=[];
async function run():Promise<void>{
  design();const leader=connect('EvaBuilder');bots.push(leader);await spawned(leader);
  let origin:Vec3|undefined;let preflight:unknown;
  for(const [x,z]of [[560,40],[560,230],[760,40]]){
    await fly(leader,new Vec3(leader.entity.position.x,170,leader.entity.position.z));await fly(leader,new Vec3(x,170,z));
    const heights:number[]=[];
    for(const dx of [-48,0,48])for(const dz of [-38,0,38]){let found=false;for(let y=169;y>=-64;y--){const block=leader.blockAt(new Vec3(x+dx,y,z+dz));if(!block)throw new Error('Terrain chunks unavailable');if(!['air','cave_air','void_air'].includes(block.name)){heights.push(y);found=true;break;}}if(!found)throw new Error('No ground under site');}
    const ground=Math.max(...heights);const candidate=new Vec3(x,ground+1,z);
    console.log(JSON.stringify({stage:'terrain',center:candidate,heightMin:Math.min(...heights),heightMax:ground}));
    if(ground-Math.min(...heights)>2){console.log(JSON.stringify({siteRejected:'uneven ground'}));continue;}
    await fly(leader,candidate.offset(0,2,0));
    try {preflight=await new BuildPreflight(leader,4_000_000,45000).inspectBounds({from:{x:x-52,y:candidate.y,z:z-43},to:{x:x+52,y:candidate.y+186,z:z+43}},'fast');origin=candidate;break;}catch(e){console.log(JSON.stringify({siteRejected:e instanceof Error?e.message:String(e)}));}
  }
  if(!origin)throw new Error('No suitable empty site found');
  const ops=commands(origin);writeFileSync(new URL('../artifacts/eva01-build-plan.json', import.meta.url),JSON.stringify({origin,blocks:world.size,operations:ops}));
  console.log(JSON.stringify({stage:'planned',origin,blocks:world.size,commands:ops.length,solid:true,dimensions:[101,186,83],preflight}));
  const prepared=await Promise.allSettled([1,2,3].map(async n=>{const worker=connect(`EvaWork${n}`);bots.push(worker);await spawned(worker);await fly(worker,new Vec3(worker.entity.position.x,170,worker.entity.position.z));await fly(worker,origin!.offset(-55,230,n*3));}));
  for(const outcome of prepared)if(outcome.status==='rejected')throw outcome.reason;
  const started=Date.now();let last=0;
  const result=await new ParallelFastExecutor(bots).execute(ops,{onProgress:(submitted,total)=>{if(submitted-last>=500||submitted===total){last=submitted;console.log(JSON.stringify({stage:'building',submitted,total,workers:4}));}}});
  const report={name:'EVA-01 Test Type',origin,dimensions:[101,186,83],solid:true,plannedBlocks:world.size,...result,buildDurationMs:Date.now()-started,verifyAfterBuild:true,visualReview:false};
  writeFileSync(new URL('../artifacts/eva01-build-result.json', import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const bot of bots)bot.quit();process.exit(process.exitCode??0);});
