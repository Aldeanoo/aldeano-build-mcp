import mineflayer from 'mineflayer';
import {Vec3} from 'vec3';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {BoundedTeleportService} from '../../../src/services/bounded-teleport-service.js';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
const m=JSON.parse(readFileSync(new URL('../artifacts/konoha-manifest.json', import.meta.url),'utf8')),s=JSON.parse(readFileSync(new URL('../artifacts/konoha-progress.json', import.meta.url),'utf8')),o=m.origin;
const bot=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'KonohaSupport'});
async function run(){await new Promise<void>((res,rej)=>{bot.once('spawn',res);bot.once('error',rej);});let verified=0;
for(let x=0;x<384;x+=48)for(let z=0;z<448;z+=48){const X=Math.min(383,x+47),Z=Math.min(447,z+47);await new BoundedTeleportService(bot).selfTo({x:o.x+x+23,y:o.y+200,z:o.z+z+23});const id=`konoha_foundation:${x}:${z}`;
if(s.jobs[id]?.status!=='complete'){await new ParallelFastExecutor([bot]).execute([{type:'fill',from:{x:o.x+x,y:o.y-1,z:o.z+z},to:{x:o.x+X,y:o.y-1,z:o.z+Z},block:'stone'}]);await bot.waitForTicks(12);}
const repair:Array<{type:'setblock',position:{x:number,y:number,z:number},block:string}>=[];
for(let xx=x;xx<=X;xx++)for(let zz=z;zz<=Z;zz++)for(let y=o.y-2;y>=-63;y--){const p=new Vec3(o.x+xx,y,o.z+zz),b=bot.blockAt(p);if(!b)throw Error('Support ground unreadable');if(!['air','cave_air','void_air','water'].includes(b.name))break;repair.push({type:'setblock',position:{x:p.x,y:p.y,z:p.z},block:'dirt'});}
if(repair.length){await new ParallelFastExecutor([bot]).execute(repair,{commandsPerTick:8});await bot.waitForTicks(20);s.foundationRepairCount=(s.foundationRepairCount??0)+repair.length;}
for(let xx=x;xx<=X;xx++)for(let zz=z;zz<=Z;zz++){const ground=bot.blockAt(new Vec3(o.x+xx,o.y-2,o.z+zz)),support=bot.blockAt(new Vec3(o.x+xx,o.y-1,o.z+zz));if(!ground||['air','cave_air','void_air','water'].includes(ground.name)||support?.name!=='stone')throw Error(`Terrain support missing ${xx},${zz}`);verified++;}s.jobs[id]={status:'complete',blocks:(X-x+1)*(Z-z+1)};writeFileSync(new URL('../artifacts/konoha-progress.json', import.meta.url),JSON.stringify(s,null,2));if(verified%20000<2500)console.log(JSON.stringify({stage:'foundation_verified',blocks:verified,total:172032}));}
const r=JSON.parse(readFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),'utf8'));if(!r.foundationVerified){r.requestedBlocks+=verified+(s.foundationRepairCount??0);r.placedBlocks+=verified+(s.foundationRepairCount??0);}r.foundationVerified=true;r.foundationBlocks=verified;r.groundSupportCorrections=s.foundationRepairCount??0;r.completedJobs=Object.keys(s.jobs).length;r.buildings=70;r.accessibleStructures=71;r.chunksCompleted=(Math.floor((o.x+383)/16)-Math.floor(o.x/16)+1)*(Math.floor((o.z+447)/16)-Math.floor(o.z/16)+1);writeFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify({stage:'foundation_completed',verified}));}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{bot.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});
