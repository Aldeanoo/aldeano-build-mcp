import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {Vec3} from 'vec3';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';

const report=JSON.parse(readFileSync(new URL('../artifacts/final-valley-result.json', import.meta.url),'utf8'));
const origin=new Vec3(report.origin.x,report.origin.y,report.origin.z);
const bot=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'ValleyDetail'});
function fill(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,block:string):FastCommandOperation{return {type:'fill',from:{x:origin.x+x1,y:origin.y+y1,z:origin.z+z1},to:{x:origin.x+x2,y:origin.y+y2,z:origin.z+z2},block};}
async function move(x:number):Promise<void>{const p=origin.offset(x,305,0);await new BoundedTeleportService(bot).selfTo({x:p.x,y:p.y,z:p.z});}
async function run():Promise<void>{
  await new Promise<void>((resolve,reject)=>{bot.once('spawn',resolve);bot.once('error',reject);bot.once('kicked',reason=>reject(new Error(String(reason))));});
  let count=0;
  for(const side of [-1,1]){
    await move(side*105);
    const ops:FastCommandOperation[]=[fill(side===-1?-126:78,124,-49,side===-1?-78:126,124,-26,'stone_bricks'),fill(side===-1?-126:105,125,-49,side===-1?-105:126,128,-26,'air')];
    for(const step of [0,1])ops.push(fill(side*(105-step),125+step,-61,side*(105-step),125+step,-57,`stone_brick_stairs[facing=${side===-1?'east':'west'}]`));
    for(const z of [-44,-32])ops.push(fill(side*120-1,80,z-1,side*120+1,123,z+1,'stone_bricks'));
    const sx=side*78;
    ops.push(fill(sx,128,-62,sx,190,-62,'stone_bricks'),fill(sx,190,-46,sx,270,-46,'stone_bricks'));
    for(const y of [67,83,99,115,135])ops.push(fill(sx,126+y,-46,sx,126+y,-46,'sea_lantern'));
    count+=(await new ParallelFastExecutor([bot]).execute(ops)).submittedCommands;
  }
  await move(0);
  count+=(await new ParallelFastExecutor([bot]).execute([fill(-20,81,-46,20,84,-42,'andesite'),fill(-24,49,-46,24,52,-37,'stone'),fill(-26,22,-46,26,25,-31,'tuff')])).submittedCommands;
  report.accessAndLedgeDetailsSubmitted=count;writeFileSync(new URL('../artifacts/final-valley-result.json', import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({status:'completed',detailsCommands:count,verification:true}));
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{bot.quit();process.exit(process.exitCode??0);});
