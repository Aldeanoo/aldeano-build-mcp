import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {Vec3} from 'vec3';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';
const report=JSON.parse(readFileSync(new URL('../artifacts/anatomy-build-result.json', import.meta.url),'utf8'));
const o=new Vec3(report.origin.x,report.origin.y,report.origin.z);
const b=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'AnatomiaBuilder'});
async function run(){await new Promise<void>((res,rej)=>{b.once('spawn',res);b.once('error',rej);});await new BoundedTeleportService(b).selfTo({x:o.x-55,y:o.y+5,z:o.z+26});if(b.entity.position.distanceTo(o.offset(-55,5,26))>2)throw Error('Arrival failed');
 const expected=new Map<string,string>();
 // Railings are in the previously inspected empty site, with landing doors.
 for(let y=5;y<=145;y++)for(let x=-50;x<=-39;x++)for(let z=21;z<=32;z++){
 if(x!==-50&&x!==-39&&z!==21&&z!==32)continue;
 if(z===21&&x>=-48&&x<=-43&&[4,76,109,126,142].some(f=>y>f&&y<=f+3))continue;
 const p=o.offset(x,y,z),v=b.blockAt(p);if(!v)throw Error('Unreadable railing location');if(!['air','cave_air','void_air'].includes(v.name))continue;expected.set(`${p.x},${p.y},${p.z}`,'glass');}
 const ops:FastCommandOperation[]=Array.from(expected,([k,block])=>{const [x,y,z]=k.split(',').map(Number);return {type:'setblock',position:{x,y,z},block};});
 await new ParallelFastExecutor([b]).execute(ops,{commandsPerTick:8});
 const labels=[{p:[-24,84,-13],text:'Pelvis: ilion, isquion, pubis y acetabulo'},{p:[25,105,-17],text:'Costillas: caja toracica; pares 11 y 12 flotantes'},{p:[-43,8,18],text:'Acceso por escalera: pies, pelvis, torax, hombros y craneo'}];
 for(const {p,text}of labels){const pos=o.offset(...p as [number,number,number]);const nbt=`{Tags:["anatomy_education"],billboard:"center",background:2003202047,line_width:300,text:${JSON.stringify(JSON.stringify({text,color:'black'}))},transformation:{scale:[1.8f,1.8f,1.8f]}}`;b.chat(`/summon minecraft:text_display ${pos.x} ${pos.y} ${pos.z} ${nbt}`);await b.waitForTicks(2);}
 await b.waitForTicks(5);for(const [k,name]of expected){const p=new Vec3(...k.split(',').map(Number) as [number,number,number]);if(b.blockAt(p)?.name!==name)throw Error(`Railing verification failed ${k}`);}
 report.labels+=labels.length;report.railingBlocks=expected.size;report.railingVerified=true;writeFileSync(new URL('../artifacts/anatomy-build-result.json', import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{b.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});
