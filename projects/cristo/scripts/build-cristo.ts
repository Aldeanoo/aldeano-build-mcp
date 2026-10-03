import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import pathfinderPkg from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import type { FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';
import { BuildPreflight } from '../../../src/build/verification/build-preflight.js';
import { MovementService } from '../../../src/services/movement-service.js';
import { ParallelFastExecutor } from '../../../src/build/executor/parallel-fast-executor.js';

const { pathfinder } = pathfinderPkg;
const bot = mineflayer.createBot({host:'127.0.0.1',port:9999,username:'CristoBuilder',plugins:{pathfinder}});
let disconnected=false;
bot.once('end',()=>{disconnected=true;});
const blocks = new Map<string,string>();
const key = (x:number,y:number,z:number) => `${x},${y},${z}`;
function box(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,b:string):void {
  for(let y=y1;y<=y2;y++) for(let z=z1;z<=z2;z++) for(let x=x1;x<=x2;x++) blocks.set(key(x,y,z),b);
}
function design():void {
  for(let x=-60;x<=60;x++) for(let z=-60;z<=60;z++) {
    const r=Math.sqrt((x/60)**2+(z/60)**2);
    if(r>1) continue;
    const ripple=(Math.sin(x*.18+z*.09)*2+Math.cos(z*.19-x*.07)*2)*Math.sin(Math.PI*Math.min(1,r));
    const h=Math.max(1,Math.floor(76*Math.max(Math.pow(1-r,0.64),Math.pow(Math.min(1,(1-r)/.65),.85))+ripple));
    for(let y=0;y<=h;y++) {
      const vegetated=z> -15 || Math.abs(x)>35;
      const material=y===h&&vegetated?'grass_block':y>=h-2&&vegetated?'dirt':((Math.floor(x/7)+Math.floor(z/8)+Math.floor(y/9))%5===0?'andesite':'stone');
      blocks.set(key(x,y,z),material);
    }
  }
  // Summit retaining foundation and broad viewing terrace.
  box(-20,60,-17,20,76,20,'stone_bricks');
  box(-21,77,-18,21,78,21,'smooth_stone');
  box(-19,79,-16,19,79,19,'polished_andesite');
  for(const x of [-21,21]) box(x,79,-18,x,80,21,'stone_brick_wall');
  box(-21,79,-18,21,80,-18,'stone_brick_wall');
  box(-21,79,21,-5,80,21,'stone_brick_wall'); box(5,79,21,21,80,21,'stone_brick_wall');
  // Switchback staircase with solid piers: 79 walkable one-block rises.
  for(let i=0;i<79;i++) {
    const leg=Math.floor(i/20), t=i%20;
    const x=leg%2===0?-24+t*2:14-t*2;
    const z=55-leg*10;
    box(x,i,z,x+2,i,z+4,'stone_bricks');
    box(x,i+1,z,x+2,i+1,z+4,leg%2===0?'stone_brick_stairs[facing=east]':'stone_brick_stairs[facing=west]');
    if(t===19) box(x,i,z-10,x+2,i,z+4,'stone_bricks');
  }
  box(-5,75,15,5,79,25,'stone_bricks');
  // Pedestal: 24 blocks for the 90-block statue, matching the 8:30 reference.
  box(-10,80,-8,10,82,8,'polished_deepslate');
  box(-8,83,-7,8,101,7,'stone_bricks');
  for(const x of [-8,8]) box(x,84,-7,x,100,7,'polished_andesite');
  box(-10,102,-9,10,103,9,'smooth_quartz');
  // Feet and continuous tapered robe, with sculpted vertical folds.
  box(-7,104,-5,-1,107,6,'smooth_quartz'); box(1,104,-5,7,107,6,'smooth_quartz');
  for(let y=108;y<=166;y++) {
    const half=Math.round(10-(y-108)*.045), depth=Math.round(6-(y-108)*.025);
    for(let x=-half;x<=half;x++) for(let z=-depth;z<=depth;z++) {
      if((x/half)**2+(z/depth)**2>1.2) continue;
      blocks.set(key(x,y,z),'smooth_quartz');
    }
    for(const x of [-6,-3,0,3,6]) if(Math.abs(x)<=half) box(x,y,-depth-1,x,y,-depth-1,'quartz_pillar');
  }
  // Shoulders and horizontal arms with hanging Art Deco sleeves.
  box(-13,157,-5,13,169,5,'smooth_quartz');
  for(let x=11;x<=38;x++) {
    const bottom=151+Math.floor((x-11)*.30);
    const top=168-Math.floor((x-11)*.045);
    for(const side of [-1,1]) box(side*x,bottom,-4,side*x,top,4,'smooth_quartz');
    for(const side of [-1,1]) box(side*x,bottom,-5,side*x,bottom+2,-5,'quartz_pillar');
  }
  for(const side of [-1,1]) for(let x=39;x<=42;x++) box(side*x,162,-2,side*x,167,2,'calcite');
  // Neck, elongated head, hair, nose and quiet facial relief.
  box(-3,170,-3,3,174,3,'smooth_quartz');
  for(let y=174;y<=192;y++) {
    const hw=y>=190?3:y<=175?4:5;
    box(-hw,y,-4,hw,y,4,'smooth_quartz');
    box(-hw,y,3,hw,y,5,'polished_diorite');
  }
  box(-5,176,-3,-4,190,3,'polished_diorite'); box(4,176,-3,5,190,3,'polished_diorite');
  box(-4,190,-4,4,192,4,'polished_diorite');
  box(-1,181,-6,1,185,-5,'calcite');
  box(-3,185,-5,-2,185,-5,'light_gray_concrete'); box(2,185,-5,3,185,-5,'light_gray_concrete');
  box(-2,178,-5,2,180,-5,'polished_diorite');
  for(const x of [-16,16]) for(const z of [-13,16]) {box(x,80,z,x,80,z,'sea_lantern');box(x,81,z,x,81,z,'smooth_stone_slab');}
  // Grass covered by the access route cannot survive; use dirt at those contacts.
  for(const [k,b] of blocks) if(b==='grass_block'){const [x,y,z]=k.split(',').map(Number);if(blocks.has(key(x,y+1,z)))blocks.set(k,'dirt');}
}
function operations(origin:Vec3):FastCommandOperation[] {
  const rows=new Map<string,Array<{x:number;b:string}>>();
  for(const [k,b] of blocks) {const [x,y,z]=k.split(',').map(Number); const rk=`${y},${z}`; const row=rows.get(rk)??[];row.push({x,b});rows.set(rk,row);}
  const ops:FastCommandOperation[]=[];
  for(const [rk,row] of rows) {
    const [y,z]=rk.split(',').map(Number);row.sort((a,b)=>a.x-b.x);
    for(let i=0;i<row.length;) {let j=i;while(j+1<row.length&&row[j+1].x===row[j].x+1&&row[j+1].b===row[i].b)j++;
      ops.push({type:'fill',from:{x:origin.x+row[i].x,y:origin.y+y,z:origin.z+z},to:{x:origin.x+row[j].x,y:origin.y+y,z:origin.z+z},block:row[i].b});i=j+1;}
  }
  // Merge identical horizontal runs through consecutive layers.
  const groups=new Map<string,Array<Extract<FastCommandOperation,{type:'fill'}>>>();
  for(const op of ops) if(op.type==='fill') {const g=`${op.from.x},${op.to.x},${op.from.z},${op.block}`;const list=groups.get(g)??[];list.push(op);groups.set(g,list);}
  const merged:FastCommandOperation[]=[];
  for(const list of groups.values()) {list.sort((a,b)=>a.from.y-b.from.y);let current=list[0];for(let i=1;i<list.length;i++){const next=list[i];if(next.from.y===current.to.y+1)current={...current,to:{...current.to,y:next.to.y}};else {merged.push(current);current=next;}}merged.push(current);}
  const depthGroups=new Map<string,Array<Extract<FastCommandOperation,{type:'fill'}>>>();
  for(const op of merged) if(op.type==='fill'){const k=`${op.from.x},${op.to.x},${op.from.y},${op.to.y},${op.block}`;const list=depthGroups.get(k)??[];list.push(op);depthGroups.set(k,list);}
  const result:FastCommandOperation[]=[];
  for(const list of depthGroups.values()){list.sort((a,b)=>a.from.z-b.from.z);let current=list[0];for(let i=1;i<list.length;i++){const next=list[i];const volume=(current.to.x-current.from.x+1)*(current.to.y-current.from.y+1)*(next.to.z-current.from.z+1);if(next.from.z===current.to.z+1&&volume<=32768)current={...current,to:{...current.to,z:next.to.z}};else{result.push(current);current=next;}}result.push(current);}
  return result.sort((a,b)=>(a.type==='fill'?a.from.y:a.position.y)-(b.type==='fill'?b.from.y:b.position.y));
}
function hollowDesign():void {
  const filled=new Set(blocks.keys());
  const directions=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const k of filled) {
    const [x,y,z]=k.split(',').map(Number);
    const surface=directions.some(([dx,dy,dz])=>[1,2].some(d=>!filled.has(key(x+dx*d,y+dy*d,z+dz*d))));
    if(!surface) blocks.delete(k);
  }
  // Four slender internal columns transfer the terrace and pedestal to the ground.
  for(const x of [-6,6]) for(const z of [-5,5]) box(x-1,0,z-1,x+1,103,z+1,'stone_bricks');
}
async function flyInSteps(destination:Vec3,worker=bot):Promise<void> {
  await new BoundedTeleportService(worker).selfTo(destination.floored());
}
async function run():Promise<void> {
  await new Promise<void>((resolve,reject)=>{bot.once('spawn',resolve);bot.once('error',reject);bot.once('kicked',r=>reject(new Error(String(r))));bot.once('end',()=>reject(new Error('Disconnected before spawn')));});
  await bot.waitForChunksToLoad();
  const start=bot.entity.position.floored();
  const rebuild=process.argv.includes('--rebuild-hollow');
  const verifyOnly=process.argv.includes('--verify-only');
  let origin:Vec3|undefined=rebuild||verifyOnly?new Vec3(295,-60,39):undefined;
  if(origin&&rebuild) {
    const cleanup:FastCommandOperation[]=[];
    for(let x=origin.x-60;x<=origin.x+60;x++) cleanup.push({type:'fill',from:{x,y:origin.y,z:origin.z-60},to:{x,y:origin.y+193,z:origin.z+60},block:'air'});
    console.log(JSON.stringify({stage:'clearing',origin,commands:cleanup.length}));
    await new ParallelFastExecutor([bot]).execute(cleanup);await bot.waitForTicks(2);
    await flyInSteps(origin.offset(0,8,0));
    await new BuildPreflight(bot,4_000_000,45000).inspectBounds({from:{x:origin.x-60,y:origin.y,z:origin.z-60},to:{x:origin.x+60,y:origin.y+192,z:origin.z+60}},'fast');
    console.log(JSON.stringify({stage:'cleared',siteEmpty:true}));
  }
  for(const [dx,dz] of rebuild||verifyOnly?[]:[[190,0],[0,190],[-190,0],[190,190]]) {
    const candidate=start.offset(dx,0,dz);
    try {
      const departure=bot.entity.position.clone();
      const steps=Math.ceil(departure.distanceTo(candidate)/55);
      for(let step=1;step<=steps;step++) {const waypoint=departure.plus(candidate.minus(departure).scaled(step/steps));await new MovementService(bot).flyTo(waypoint.x,candidate.y+8,waypoint.z);}
      await new BuildPreflight(bot,4_000_000,45000).inspectBounds({from:{x:candidate.x-60,y:candidate.y,z:candidate.z-60},to:{x:candidate.x+60,y:candidate.y+192,z:candidate.z+60}},'fast');origin=candidate;break;
    }
    catch(e){console.log(JSON.stringify({siteRejected:candidate,reason:e instanceof Error?e.message:String(e)}));}
  }
  if(!origin) throw new Error('No empty site found');
  design();const solidBlocks=blocks.size;hollowDesign(); const ops=operations(origin);
  console.log(JSON.stringify({stage:verifyOnly?'verifying':'building',origin,blocks:blocks.size,solidBlocks,savedBlocks:solidBlocks-blocks.size,commands:ops.length,dimensions:[121,193,121],hollow:true}));
  if(!verifyOnly) {
    const count=Number(process.argv.find(arg=>arg.startsWith('--workers='))?.split('=')[1]??2);
    if(!Number.isInteger(count)||count<1||count>4)throw new Error('workers must be between 1 and 4');
    const workers=[bot];
    try {
      await Promise.all(Array.from({length:count-1},async (_,index)=>{
        const worker=mineflayer.createBot({host:'127.0.0.1',port:9999,username:`CristoWork${index+1}`,plugins:{pathfinder}});
        workers.push(worker);
        await new Promise<void>((resolve,reject)=>{worker.once('spawn',resolve);worker.once('error',reject);worker.once('kicked',r=>reject(new Error(String(r))));worker.once('end',()=>reject(new Error('Worker disconnected')));});
        await flyInSteps(new Vec3(worker.entity.position.x,origin!.y+210,worker.entity.position.z),worker);
        await flyInSteps(origin!.offset(-64,210,index*3),worker);
      }));
      let lastReport=0;
      await new ParallelFastExecutor(workers).execute(ops,{onProgress:(submitted,total)=>{if(submitted-lastReport>=500||submitted===total){lastReport=submitted;console.log(JSON.stringify({stage:'progress',submittedCommands:submitted,total,workers:workers.length}));}}});
    } finally {for(const worker of workers)if(worker!==bot)worker.quit();}
  }
  if(verifyOnly){
    // Exit the pedestal's overhang horizontally before ascending.
    await flyInSteps(new Vec3(origin.x-64,bot.entity.position.y,origin.z-64));
    await flyInSteps(origin.offset(-64,210,-64));
    await flyInSteps(origin.offset(0,210,0));
  }
  await bot.waitForChunksToLoad();await bot.waitForTicks(2);
  let correct=0;let unavailable=0;const repair:FastCommandOperation[]=[];
  const differences:Array<{position:Vec3;expected:string;actual:string}>=[];
  for(const [k,b] of blocks) {const [x,y,z]=k.split(',').map(Number);const p=origin.offset(x,y,z);const actual=bot.blockAt(p);if(!actual){unavailable++;continue;}if(actual.name===b.split('[')[0])correct++;else {repair.push({type:'setblock',position:{x:p.x,y:p.y,z:p.z},block:b});if(differences.length<12)differences.push({position:p,expected:b,actual:actual.name});}}
  if(unavailable)throw new Error(`Verification unavailable: ${unavailable} positions are in unloaded chunks; no repair submitted`);
  if(differences.length)console.log(JSON.stringify({stage:'differences',samples:differences}));
  if(repair.length) {console.log(JSON.stringify({stage:'repair',differences:repair.length,samples:repair.slice(0,12)}));await new ParallelFastExecutor([bot]).execute(repair);await bot.waitForTicks(2);}
  let finalCorrect=0;for(const [k,b] of blocks){const [x,y,z]=k.split(',').map(Number);if(bot.blockAt(origin.offset(x,y,z))?.name===b.split('[')[0]) finalCorrect++;}
await finalizeVoxels(bot,blocks,origin,{mode:'fast'});
  const report={origin,dimensions:[121,193,121],hollow:true,solidBlocks,savedBlocks:solidBlocks-blocks.size,expected:blocks.size,initialCorrect:correct,finalCorrect,accuracy:finalCorrect/blocks.size,visualReview:false};
  writeFileSync(new URL('../artifacts/cristo-build-result.json', import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
  const exit=()=>process.exit(process.exitCode??0);
  if(disconnected)exit();else {bot.once('end',exit);bot.quit();}
});
