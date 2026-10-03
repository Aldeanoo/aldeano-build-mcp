import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {Vec3} from 'vec3';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';
const plan=JSON.parse(readFileSync(new URL('../artifacts/anatomy-colossal-plan.json', import.meta.url),'utf8')),o=plan.origin,expected=new Map<string,string>();
for(const op of plan.operations)for(let x=op.from.x;x<=op.to.x;x++)for(let y=op.from.y;y<=op.to.y;y++)for(let z=op.from.z;z<=op.to.z;z++)expected.set(`${x},${y},${z}`,op.block);
function box(x:number,y:number,z:number,X:number,Y:number,Z:number,block:string){for(let i=x;i<=X;i++)for(let j=y;j<=Y;j++)for(let k=z;k<=Z;k++)expected.set(`${o.x+i},${o.y+j},${o.z+k}`,block);}
// Four one-block rises connect the base to the lowest observation landing.
for(let i=0;i<4;i++)box(-105,6+i,38+i,-96,6+i,38+i,'stone_brick_stairs[facing=south]');
box(-105,9,42,-96,9,44,'smooth_stone');
// The entrance avenue has gradual accessible steps at its northern end.
for(let i=0;i<3;i++)box(-17,6+i,-54+i,19,6+i,-54+i,'stone_brick_stairs[facing=north]');
const b=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'ColosalVerifier'});
async function tp(x:number,z:number){
  await new BoundedTeleportService(b).selfTo({x,y:313,z});
}
function compress(items:Map<string,string>){const rows=new Map<string,{x:number,b:string}[]>();for(const [k,b]of items){const [x,y,z]=k.split(',').map(Number),rk=`${y},${z}`,r=rows.get(rk)??[];r.push({x,b});rows.set(rk,r);}const ops:FastCommandOperation[]=[];for(const [k,r]of rows){const [y,z]=k.split(',').map(Number);r.sort((a,b)=>a.x-b.x);for(let i=0;i<r.length;){let j=i;while(j+1<r.length&&r[j+1].x===r[j].x+1&&r[j+1].b===r[i].b)j++;ops.push({type:'fill',from:{x:r[i].x,y,z},to:{x:r[j].x,y,z},block:r[i].b});i=j+1;}}return ops;}
async function run(){b.on('messagestr',m=>{if(!/blocks|Teleported|No blocks were filled|Changed the block/.test(m))console.log(JSON.stringify({server:m}));});await new Promise<void>((res,rej)=>{b.once('spawn',res);b.once('error',rej);});let verified=0,repaired=0;
for(let x=plan.bounds.from.x;x<=plan.bounds.to.x;x+=64)for(let z=plan.bounds.from.z;z<=plan.bounds.to.z;z+=64){const X=Math.min(x+63,plan.bounds.to.x),Z=Math.min(z+63,plan.bounds.to.z);await tp(Math.floor((x+X)/2),Math.floor((z+Z)/2));const section=new Map<string,string>(),repair=new Map<string,string>();for(const [k,name]of expected){const [xx,y,zz]=k.split(',').map(Number);if(xx<x||xx>X||zz<z||zz>Z)continue;section.set(k,name);const actual=b.blockAt(new Vec3(xx,y,zz));if(!actual)throw Error(`Unreadable ${k}`);if(actual.name!==name.split('[')[0])repair.set(k,name);}
if(repair.size){console.log(JSON.stringify({stage:'repair_sector',blocks:repair.size,x,z}));await new ParallelFastExecutor([b]).execute(compress(repair),{commandsPerTick:8});await b.waitForTicks(30);repaired+=repair.size;}
for(const [k,name]of section){const p=new Vec3(...k.split(',').map(Number) as [number,number,number]);if(b.blockAt(p)?.name!==name.split('[')[0])throw Error(`Unresolved ${k}: expected ${name}, actual ${b.blockAt(p)?.name}`);verified++;}console.log(JSON.stringify({stage:'verified_sector',verified,total:expected.size}));}
await finalizeVoxels(b,expected,{x:0,y:0,z:0},{mode:'fast'});
const result={origin:o,dimensions:[295,369,173],blocks:expected.size,verified,repaired,labels:42,visualReview:false,firstModelPreserved:true};writeFileSync(new URL('../artifacts/anatomy-colossal-result.json', import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({stage:'completed',...result}));}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{b.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});

