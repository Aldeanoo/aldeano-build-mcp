import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import {Vec3} from 'vec3';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';
const r=JSON.parse(readFileSync(new URL('../artifacts/anatomy-colossal-result.json', import.meta.url),'utf8')),o=r.origin,b=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'ColosalAccess'});
async function run(){await new Promise<void>((res,rej)=>{b.once('spawn',res);b.once('error',rej);});b.creative.startFlying();await new BoundedTeleportService(b).selfTo({x:o.x-25,y:o.y+15,z:o.z-70});const ops:FastCommandOperation[]=[];
for(let i=0;i<3;i++)for(let z=-80;z<=-60;z++)for(let y=6;y<=6+i;y++){const p={x:o.x-21+i,y:o.y+y,z:o.z+z},actual=b.blockAt(new Vec3(p.x,p.y,p.z));if(!actual||!['air','cave_air','void_air'].includes(actual.name))throw Error('Entrance steps destination not empty');ops.push({type:'setblock',position:p,block:y===6+i?'stone_brick_stairs[facing=east]':'smooth_stone'});}
await new ParallelFastExecutor([b]).execute(ops,{commandsPerTick:6});await b.waitForTicks(30);for(const op of ops){if(op.type!=='setblock')continue;if(b.blockAt(new Vec3(op.position.x,op.position.y,op.position.z))?.name!==op.block.split('[')[0])throw Error('Access check failed');}
r.blocks+=ops.length;r.verified+=ops.length;r.entranceStepsVerified=true;writeFileSync(new URL('../artifacts/anatomy-colossal-result.json', import.meta.url),JSON.stringify(r,null,2));console.log(JSON.stringify(r));}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{b.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});
