import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {Vec3} from 'vec3';
import {BuildPreflight} from '../../../src/build/verification/build-preflight.js';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';
const source=JSON.parse(readFileSync(new URL('../artifacts/anatomy-build-plan.json', import.meta.url),'utf8'));
const S=2.25, q=(n:number)=>Math.floor(n*S), blocks=new Map<string,string>();
const key=(x:number,y:number,z:number)=>`${x},${y},${z}`;
const put=(x:number,y:number,z:number,b:string)=>blocks.set(key(x,y,z),b);
function box(x:number,y:number,z:number,X:number,Y:number,Z:number,b:string){for(let i=Math.min(x,X);i<=Math.max(x,X);i++)for(let j=y;j<=Y;j++)for(let k=Math.min(z,Z);k<=Math.max(z,Z);k++)put(i,j,k,b);}
function cut(x:number,y:number,z:number,X:number,Y:number,Z:number){for(let i=x;i<=X;i++)for(let j=y;j<=Y;j++)for(let k=z;k<=Z;k++)blocks.delete(key(i,j,k));}
function design(){
 for(const op of source.operations){const a=op.from,c=op.to,b=op.block;for(let x=a.x-source.origin.x;x<=c.x-source.origin.x;x++)for(let y=a.y-source.origin.y;y<=c.y-source.origin.y;y++)for(let z=a.z-source.origin.z;z<=c.z-source.origin.z;z++){
 if(x>=-52&&x<=-38&&z>=19&&z<=33)continue;
 box(q(x),q(y),q(z),q(x+1)-1,q(y+1)-1,q(z+1)-1,b);
 }}
 // Rebuild the circulation tower for one-block step heights at the new scale.
 for(const x of [-118,-83])for(const z of [42,78])box(x,7,z,x+1,329,z+1,'polished_andesite');
 for(let y=9;y<=327;y++){const ph=(y-9)%88;let x:number,z:number,d:string;
 if(ph<22){x=-112+ph;z=49;d='east';}else if(ph<44){x=-90;z=49+ph-22;d='south';}else if(ph<66){x=-90-(ph-44);z=71;d='west';}else{x=-112;z=71-(ph-66);d='north';}
 if(d==='east'||d==='west'){box(x,y-1,z,x,y-1,z+3,'smooth_stone');box(x,y,z,x,y,z+3,`stone_brick_stairs[facing=${d}]`);}else{box(x,y-1,z,x+3,y-1,z,'smooth_stone');box(x,y,z,x+3,y,z,`stone_brick_stairs[facing=${d}]`);}}
 for(const y of [9,135,171,245,283,319]){box(-117,y,43,-84,y,77,'smooth_stone');box(-105,y,37,-96,y,49,'smooth_stone');for(const x of [-117,-84])box(x,y+1,43,x,y+2,77,'glass');for(const z of [43,77]){box(-117,y+1,z,-106,y+2,z,'glass');box(-95,y+1,z,-84,y+2,z,'glass');}for(const x of [-114,-87])for(const z of [46,74])put(x,y,z,'sea_lantern');}
 // Exterior transparent guard shell, with doors at the landings.
 for(let y=10;y<=329;y++)for(let x=-115;x<=-86;x++)for(let z=46;z<=75;z++){if(x!==-115&&x!==-86&&z!==46&&z!==75)continue;if(z===46&&x>=-105&&x<=-96&&[9,135,171,245,283,319].some(f=>y>f&&y<=f+4))continue;if(!blocks.has(key(x,y,z)))put(x,y,z,'glass');}
 // Accessible long-bone medullary canal: cortical shell, floor and entry.
 for(const s of [-1,1])for(let y=120;y<=165;y++){const cx=Math.round(s*(q(11)+(y-q(50))/(q(77)-q(50))*q(4)));for(let x=cx-4;x<=cx+4;x++)for(let z=-4;z<=4;z++)if((x-cx)**2+z*z<=16)blocks.delete(key(x,y,z));}
 box(23,135,-3,35,135,4,'smooth_stone');cut(24,136,-10,33,141,-3);box(24,135,-14,33,135,-4,'smooth_stone');
 // A dedicated gallery connects the cut-away femoral chamber to the tower.
 box(-101,135,-17,32,135,-14,'smooth_stone');box(-105,135,-14,-101,135,49,'smooth_stone');
 for(const x of [-76,-44,0,31])box(x,7,-15,x+1,134,-14,'polished_andesite');
 for(const z of [-18,-13])box(-100,136,z,32,137,z,'glass');
 // Cranial sutures, orbital rims, foramina and individually spaced tooth crowns.
 for(let y=q(149);y<=q(160);y++){const z=-Math.round(22*Math.sqrt(Math.max(0,1-((y-q(151))/27)**2)));for(const x of [-1,0,1])if(blocks.has(key(x,y,z)))put(x,y,z,'polished_diorite');}
 for(let x=-21;x<=21;x++){const y=q(153)+Math.round(Math.cos(x*.4));const z=-Math.round(21*Math.sqrt(Math.max(0,1-(x/27)**2)));if(blocks.has(key(x,y,z)))put(x,y,z,'polished_diorite');}
 for(const s of [-1,1]){for(let y=q(143);y<=q(150);y++){const x=s*q(10);if(blocks.has(key(x,y,q(-7))))put(x,y,q(-7),'smooth_quartz');}cut(s<0?-22:17,q(144),q(-9),s<0?-17:22,q(145),q(-8));}
 for(let x=-11;x<=11;x+=3){box(x,q(139),q(-11)-1,x+1,q(139)+2,q(-11),'smooth_quartz');box(x,q(137),q(-11)-1,x+1,q(137)+1,q(-11),'quartz_block');}
 // Distinct intervertebral disc rings retain the bony posterior processes.
 for(const [start,n,step,r]of [[91,5,3,7],[106,12,2,5],[130,7,2,4]])for(let i=0;i<n-1;i++){const y=q(start+i*step)+3;for(let x=-r;x<=r;x++)for(let z=7;z<=17;z++)if(blocks.has(key(x,y,z)))put(x,y,z,'light_gray_concrete');}
 // Mark femoral epiphyses and patellar joint faces in a subtle ivory palette.
 for(const s of [-1,1])for(let y=q(44);y<=q(48);y++)for(let x=s*q(11)-4;x<=s*q(11)+4;x++){const z=q(-6);if(blocks.has(key(x,y,z)))put(x,y,z,'smooth_quartz');}
}
function operations(o:Vec3){const rows=new Map<string,{x:number,b:string}[]>();for(const [k,b]of blocks){const [x,y,z]=k.split(',').map(Number);const rk=`${y},${z}`,row=rows.get(rk)??[];row.push({x,b});rows.set(rk,row);}const runs:FastCommandOperation[]=[];for(const [k,row]of rows){const [y,z]=k.split(',').map(Number);row.sort((a,b)=>a.x-b.x);for(let i=0;i<row.length;){let j=i;while(j+1<row.length&&row[j+1].x===row[j].x+1&&row[j+1].b===row[i].b)j++;runs.push({type:'fill',from:{x:o.x+row[i].x,y:o.y+y,z:o.z+z},to:{x:o.x+row[j].x,y:o.y+y,z:o.z+z},block:row[i].b});i=j+1;}}
 // Merge identical X runs vertically, retaining Minecraft fill-volume limits.
 const groups=new Map<string,Extract<FastCommandOperation,{type:'fill'}>[]>();for(const op of runs)if(op.type==='fill'){const k=`${op.from.x},${op.to.x},${op.from.z},${op.block}`,g=groups.get(k)??[];g.push(op);groups.set(k,g);}const merged:FastCommandOperation[]=[];for(const g of groups.values()){g.sort((a,b)=>a.from.y-b.from.y);for(let i=0;i<g.length;){let j=i;while(j+1<g.length&&g[j+1].from.y===g[j].to.y+1&&(g[j+1].to.y-g[i].from.y+1)*(g[i].to.x-g[i].from.x+1)<=32768)j++;merged.push({...g[i],to:{...g[i].to,y:g[j].to.y}});i=j+1;}}return merged;}
const bots:mineflayer.Bot[]=[];
async function connect(name:string){const b=mineflayer.createBot({host:'127.0.0.1',port:9999,username:name});bots.push(b);await new Promise<void>((res,rej)=>{b.once('spawn',res);b.once('error',rej);b.once('kicked',r=>rej(Error(String(r))));});await b.waitForChunksToLoad();return b;}
async function tp(b:mineflayer.Bot,p:Vec3){
  await new BoundedTeleportService(b).selfTo(p.floored());
}
async function run(){design();console.log(JSON.stringify({stage:'designed',blocks:blocks.size,scale:S}));const b=await connect('ColosalBuilder');if(b.game.gameMode!=='creative')throw Error('Creative required');await new BoundedTeleportService(b).selfToPlayer('Aldeano_');const p=b.players[Object.keys(b.players).find(n=>n.toLowerCase()==='aldeano_')??'']?.entity;if(!p||b.entity.position.distanceTo(p.position)>5)throw Error('Player teleport not confirmed');
 const o=new Vec3(source.origin.x+350,source.origin.y,source.origin.z-180);const bounds={from:{x:o.x+q(-65),y:o.y,z:o.z+q(-38)},to:{x:o.x+q(66)-1,y:o.y+q(164)-1,z:o.z+q(39)-1}};
 if(bounds.to.y>318)throw Error('Height exceeds build ceiling');let scanned=0;
 // Tile site reads so that every position is loaded; no construction before all pass.
 for(let x=bounds.from.x;x<=bounds.to.x;x+=64)for(let z=bounds.from.z;z<=bounds.to.z;z+=64){const endX=Math.min(x+63,bounds.to.x),endZ=Math.min(z+63,bounds.to.z);await tp(b,new Vec3(Math.floor((x+endX)/2),o.y+2,Math.floor((z+endZ)/2)));const r=await new BuildPreflight(b,2_000_000,45000).inspectBounds({from:{x,y:o.y,z},to:{x:endX,y:bounds.to.y,z:endZ}},'fast');scanned+=r.scannedBlocks;console.log(JSON.stringify({stage:'preflight',scannedBlocks:scanned}));}
 const ops=operations(o);writeFileSync(new URL('../artifacts/anatomy-colossal-plan.json', import.meta.url),JSON.stringify({origin:o,scale:S,bounds,blocks:blocks.size,operations:ops,verifyAfterBuild:true,visualReview:false}));console.log(JSON.stringify({stage:'site_clear',origin:o,bounds,blocks:blocks.size,commands:ops.length}));
 const centers=[-110,-35,40,115];await tp(b,o.offset(centers[0],q(164)+2,0));for(let i=1;i<4;i++){const w=await connect(`ColosalWork${i}`);await tp(w,o.offset(centers[i],q(164)+2,0));}
 let last=0;await new ParallelFastExecutor(bots).execute(ops,{commandsPerTick:8,onProgress:(n,total)=>{if(n-last>=1000||n===total){last=n;console.log(JSON.stringify({stage:'building',commands:n,total}));}}});
 const labels=source.labels.map((v:{p:number[],text:string})=>({p:v.p.map(q),text:v.text}));labels.push({p:[-60,190,-28],text:'Pelvis: ilion, isquion, pubis | acetabulo | agujero obturador'},{p:[58,234,-38],text:'Costillas: 12 pares | 7 verdaderas, 3 falsas, 2 flotantes'},{p:[37,140,-20],text:'Interior del femur: cortical y cavidad medular'},{p:[-99,14,39],text:'Escalera continua | 5 niveles y galeria del femur'},{p:[0,328,-37],text:'Suturas craneales | Orbitas | Cavidad nasal | Maxilar'},{p:[-24,214,40],text:'Cuerpos vertebrales | discos | arco y apofisis espinosa'});
 for(const {p,text}of labels){const v=o.offset(...p as [number,number,number]);b.chat(`/summon minecraft:text_display ${v.x} ${v.y} ${v.z} {Tags:["anatomy_colossal"],billboard:"center",background:2003202047,line_width:400,text:${JSON.stringify(JSON.stringify({text,color:'black'}))},transformation:{scale:[3.6f,3.6f,3.6f]}}`);await b.waitForTicks(1);}
 // Verify each X partition against its worker's loaded world data.
 const patches:FastCommandOperation[]=[];let verified=0;for(const [k,name]of blocks){const [x,y,z]=k.split(',').map(Number);const v=o.offset(x,y,z);const worker=bots[Math.min(3,Math.floor((x-q(-65))/Math.ceil((q(66)-q(-65))/4)))];const actual=worker.blockAt(v);if(!actual)throw Error(`Verification unavailable ${v}`);if(actual.name===name.split('[')[0])verified++;else patches.push({type:'setblock',position:{x:v.x,y:v.y,z:v.z},block:name});}
 if(patches.length){console.log(JSON.stringify({stage:'repair',differences:patches.length}));await new ParallelFastExecutor(bots).execute(patches,{commandsPerTick:8});await b.waitForTicks(10);}
 let correct=0;for(const [k,name]of blocks){const [x,y,z]=k.split(',').map(Number);const worker=bots[Math.min(3,Math.floor((x-q(-65))/Math.ceil((q(66)-q(-65))/4)))];if(worker.blockAt(o.offset(x,y,z))?.name===name.split('[')[0])correct++;}
await finalizeVoxels(b,blocks,o,{mode:'fast'});
 const result={origin:o,scale:S,dimensions:[bounds.to.x-bounds.from.x+1,369,bounds.to.z-bounds.from.z+1],blocks:blocks.size,verified:correct,labels:labels.length,visualReview:false};writeFileSync(new URL('../artifacts/anatomy-colossal-result.json', import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({stage:'completed',...result}));if(correct!==blocks.size)throw Error('Structural differences remain');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const b of bots)b.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});


