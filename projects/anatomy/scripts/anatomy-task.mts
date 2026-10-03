import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { finalizeVoxels } from '../../../src/build/verification/build-completion.js';
import {Vec3} from 'vec3';
import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {BuildPreflight} from '../../../src/build/verification/build-preflight.js';
import {ParallelFastExecutor} from '../../../src/build/executor/parallel-fast-executor.js';
import type {FastCommandOperation} from '../../../src/build/executor/fast-command-batch.js';
const vox=new Map<string,string>(), labels:Array<{p:number[],text:string}>=[];
const put=(x:number,y:number,z:number,b='bone_block')=>vox.set(`${Math.round(x)},${Math.round(y)},${Math.round(z)}`,b);
function box(a:number[],c:number[],b:string){for(let x=Math.min(a[0],c[0]);x<=Math.max(a[0],c[0]);x++)for(let y=a[1];y<=c[1];y++)for(let z=Math.min(a[2],c[2]);z<=Math.max(a[2],c[2]);z++)put(x,y,z,b);}
function ell(c:number[],r:number[],b='bone_block',shell=false){for(let x=Math.floor(c[0]-r[0]);x<=c[0]+r[0];x++)for(let y=Math.floor(c[1]-r[1]);y<=c[1]+r[1];y++)for(let z=Math.floor(c[2]-r[2]);z<=c[2]+r[2];z++){let d=c.map((v,i)=>(([x,y,z][i]-v)/r[i])**2).reduce((a,b)=>a+b);if(d<=1&&(!shell||c.map((v,i)=>(([x,y,z][i]-v)/Math.max(.5,r[i]-2))**2).reduce((a,b)=>a+b)>=1))put(x,y,z,b);}}
function tube(a:number[],b:number[],r:number,m='bone_block',h=false){const n=Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))*2);for(let t=0;t<=n;t++)ell(a.map((v,i)=>v+(b[i]-v)*t/n),[r,r,r],m,h);}
function curve(points:number[][],r:number,m='bone_block'){for(let i=1;i<points.length;i++)tube(points[i-1],points[i],r,m);}
const label=(p:number[],text:string)=>labels.push({p,text});
function design(){
 // Raised museum base with occupied volumes preserved by mandatory preflight.
 box([-65,0,-38],[65,1,38],'polished_deepslate');box([-64,2,-37],[64,2,37],'smooth_stone');
 for(const x of [-64,64])box([x,3,-37],[x,4,37],'stone_brick_wall');
 for(let x=-60;x<=60;x+=10)for(const z of [-33,33])put(x,3,z,'sea_lantern');
 box([-8,3,-38],[8,3,-23],'polished_andesite');
 // Legs, paired tibia and fibula, joint gaps, hollow femoral shafts.
 for(const s of [-1,1]){
 tube([s*10,12,1],[s*10,43,0],3,'bone_block',true);tube([s*15,12,2],[s*15,43,1],1.3,'calcite');
 ell([s*11,45,0],[5,3,4]);ell([s*11,47,-5],[2.5,3,2],'smooth_quartz');
 tube([s*11,50,0],[s*15,77,1],3.7,'bone_block',true);ell([s*11,50,0],[5,3,4]);
 tube([s*15,77,1],[s*10,80,1],3);ell([s*10,80,1],[4,4,4]);
 // Seven tarsals and five metatarsals with individually separated toes.
 const tar=[[0,6,5],[0,9,2],[-3,7,0],[3,7,0],[-3,6,-4],[0,6,-4],[3,6,-4]];
 for(const [x,y,z] of tar)ell([s*11+x,y,z],[2,2,2],'calcite');
 for(let f=0;f<5;f++){const x=s*11-6+f*3;const end=-17+f; tube([x,6,-5],[x,5,end],1);for(let j=0;j<(f===0?2:3);j++)tube([x,5,end-j*3-1],[x,4,end-j*3-2],.8,'smooth_quartz');}
 label([s*20,44,-12],'Rodilla: rotula / patella');label([s*20,60,-12],'Femur: diafisis y epifisis');label([s*20,26,-12],'Tibia medial | Fibula lateral');label([s*20,5,-28],'Tarso 7 | Metatarso 5 | Falanges 14');
 // Iliac wings, acetabular cups and open pelvic ring / obturator foramina.
 ell([s*13,84,3],[10,10,7],'calcite',true);
 curve([[s*4,78,-4],[s*8,75,-5],[s*15,77,-2],[s*19,82,2]],2.3);
 curve([[s*4,78,-4],[s*5,72,-1],[s*12,72,4],[s*17,78,4]],2);
 ell([s*10,80,1],[5,5,5],'smooth_quartz',true);
 // Humerus and supinated forearms, radius on thumb side.
 ell([s*25,125,0],[4,4,4]);tube([s*26,122,0],[s*32,101,0],3);
 ell([s*32,99,0],[4,3,3]);tube([s*31,96,0],[s*34,76,0],1.6,'bone_block');tube([s*36,96,0],[s*39,76,0],1.8,'calcite');
 for(let row=0;row<2;row++)for(let j=0;j<4;j++)ell([s*(33+j*2),73-row*3,0],[.8,1,.9],'smooth_quartz');
 for(let f=0;f<5;f++){const x=s*(32+f*3);const y=65+(f===0?3:0);tube([s*(33+f*1.8),68,0],[x,y,0],.85);for(let j=0;j<(f===4?2:3);j++){const xx=x+s*(f===4?j*1.5:0);tube([xx,y-2-j*3,0],[xx+s*.3,y-3-j*3,0],.85,'calcite');}}
 label([s*43,111,-7],'Humero');label([s*46,87,-7],'Radio lateral | Ulna medial');label([s*48,65,-7],'Carpos 8 | Metacarpos 5 | Falanges 14');
 // Scapula triangular hollow plate and spine; clavicle S curve.
 for(let y=110;y<=125;y++){let w=(y-109)*.5;for(let x=12;x<=12+w;x++)put(s*x,y,9,'calcite');}
 tube([s*12,121,10],[s*23,124,10],1.3,'smooth_quartz');
 curve([[s*2,126,-7],[s*9,128,-8],[s*17,126,-6],[s*24,126,-1]],1.5,'smooth_quartz');
 label([s*26,129,-11],'Clavicula');label([s*24,116,16],'Escapula y espina escapular');
 }
 // Sacrum and segmented 5 lumbar, 12 thoracic, 7 cervical vertebrae.
 for(let y=77;y<=89;y++)ell([0,y,6],[Math.max(1,(y-75)*.38),.8,2.5],'calcite');tube([0,76,6],[0,72,8],1);
 const vertebra=(y:number,r:number,z:number)=>{ell([0,y,z],[r,1.1,2.7]);ell([0,y,z+3],[r+1,1,3],'bone_block',true);tube([0,y,z+4],[0,y-1,z+8],1);tube([-r-2,y,z+2],[r+2,y,z+2],.8,'calcite');};
 for(let i=0;i<5;i++)vertebra(91+i*3,3.5,5-i*.3);
 for(let i=0;i<12;i++)vertebra(106+i*2,2.5,5+Math.sin(i/11*Math.PI)*2);
 for(let i=0;i<7;i++)vertebra(130+i*2,1.8,4-i*.4);
 label([-8,135,17],'Cervical: C1-C7');label([-8,118,19],'Toracica: T1-T12');label([-8,96,17],'Lumbar: L1-L5');label([-8,82,17],'Sacro y coccix');
 // 12 distinct rib pairs: first seven true, three false, two floating.
 for(let i=0;i<12;i++){const y=128-i*2.5;const w=11+Math.sin(i/11*Math.PI)*10;for(const s of [-1,1]){const pts:number[][]=[];const end=i<10?Math.PI:Math.PI*.65;for(let t=0;t<=24;t++){const a=end*t/24;pts.push([s*(2+w*Math.sin(a)),y-3*Math.sin(a/2),5-17*(1-Math.cos(a))/2]);}curve(pts,.75,i<7?'bone_block':'calcite');if(i<10)tube(pts.at(-1)!,[s*1.5,Math.max(108,y-5),-12],.65,'smooth_quartz');}}
 box([-2,110,-13],[2,125,-11],'bone_block');ell([0,126,-12],[3,2,2]);tube([0,109,-12],[0,106,-12],.8);
 label([7,120,-19],'Esternon: manubrio / cuerpo / xifoides');label([-25,110,-16],'12 pares: 7 verdaderas, 3 falsas, 2 flotantes');
 // Three-dimensional hollow neurocranium, sculpted facial bones, open orbits.
 ell([0,151,1],[12,12,10],'bone_block',true);
 ell([0,146,-7],[10,7,5],'calcite',true);
 for(const x of [-5,5])ell([x,148,-10],[3.3,3.3,5],'air');
 ell([0,144,-11],[2,3.5,4],'air');
 for(const s of [-1,1])curve([[s*3,142,-11],[s*9,145,-10],[s*11,147,-4]],1.2,'smooth_quartz');
 curve([[-9,145,-3],[-8,137,-6],[-5,136,-11],[5,136,-11],[8,137,-6],[9,145,-3]],1.5);
 for(let x=-5;x<=5;x+=2){put(x,139,-11,'quartz_block');put(x,137,-11,'quartz_block');}
 curve([[-3,134,-4],[0,133,-6],[3,134,-4]],.65,'calcite');
 // Occipital observation entry preserves enough vault; internal floor.
 box([-3,143,8],[3,147,12],'air');box([-7,142,-4],[7,142,6],'smooth_stone');
 label([-17,151,-14],'Craneo: frontal, parietal, temporal, occipital');label([15,137,-14],'Mandibula | Maxilar | Hioides');
 // Rear circulation tower with fully walkable one-block-rise stairs.
 for(const x of [-51,-39])for(const z of [20,32])box([x,3,z],[x,149,z],'polished_andesite');
 for(let y=4;y<=145;y++){const phase=(y-4)%32;let x:number,z:number,dir:string;if(phase<8){x=-49+phase;z=22;dir='east';}else if(phase<16){x=-41;z=22+phase-8;dir='south';}else if(phase<24){x=-41-(phase-16);z=30;dir='west';}else{x=-49;z=30-(phase-24);dir='north';}box([x,y-1,z],[x+1,y-1,z+1],'smooth_stone');box([x,y,z],[x+1,y,z+1],`stone_brick_stairs[facing=${dir}]`);}
 for(const y of [4,76,109,126,142]){
 box([-52,y,19],[-38,y,33],'smooth_stone');box([-48,y,17],[-43,y,22],'smooth_stone');
 box([-45,y,14],[29,y,17],'smooth_stone');for(const z of [13,18])box([-44,y+1,z],[29,y+1,z],'glass');
 for(const x of [-30,0,28])box([x,3,15],[x,y-1,15],'polished_andesite');
 for(let x=-43;x<=28;x+=8)put(x,y,15,'sea_lantern');
 label([-43,y+2,19],`Nivel ${y}: recorrido de observacion`);
 }
 box([-7,76,-2],[7,76,5],'smooth_stone');box([-3,76,5],[3,76,14],'smooth_stone');
 box([-12,109,-6],[12,109,2],'smooth_stone');box([-3,109,2],[3,109,14],'smooth_stone');
 box([-3,142,9],[3,142,14],'smooth_stone');
 for(const s of [-1,1]){box([s*29,76,1],[s*39,76,14],'smooth_stone');box([s*23,126,3],[s*29,126,14],'smooth_stone');}
 // Complementary isolated enlarged vertebra and long-bone section exhibit.
 ell([45,9,22],[5,3,4],'bone_block');ell([45,9,29],[7,2,6],'calcite',true);tube([37,9,26],[53,9,26],1.5);tube([45,9,33],[45,9,37],1.5);
 tube([46,7,-17],[46,30,-17],4,'bone_block',true);ell([46,32,-17],[6,4,5]);box([46,13,-22],[52,24,-17],'air');tube([46,8,-17],[46,29,-17],1,'pink_terracotta');
 label([46,6,16],'Vertebra ampliada: cuerpo, arco, apofisis');label([46,6,-26],'Corte de hueso largo: cortical y cavidad medular');
 label([0,6,-35],'MUSEO DEL SISTEMA OSEO | Modelo educativo a escala monumental');
 label([-38,6,-30],'Adulto: habitualmente 206 huesos | Axial 80 | Apendicular 126');
 label([0,6,30],'Eje axial: craneo, columna y torax | Apendicular: cinturas y extremidades');
 // Remove carved air from placement; the verified site is already empty.
 for(const [k,b] of vox)if(b==='air')vox.delete(k);
}
function operations(o:Vec3){const rows=new Map<string,{x:number,b:string}[]>();for(const [k,b]of vox){const [x,y,z]=k.split(',').map(Number);const key=`${y},${z}`;const row=rows.get(key)??[];row.push({x,b});rows.set(key,row);}const ops:FastCommandOperation[]=[];for(const [key,row]of rows){const [y,z]=key.split(',').map(Number);row.sort((a,b)=>a.x-b.x);for(let i=0;i<row.length;){let j=i;while(j+1<row.length&&row[j+1].x===row[j].x+1&&row[j+1].b===row[i].b)j++;ops.push({type:'fill',from:{x:o.x+row[i].x,y:o.y+y,z:o.z+z},to:{x:o.x+row[j].x,y:o.y+y,z:o.z+z},block:row[i].b});i=j+1;}}return ops;}
const bots:mineflayer.Bot[]=[];
async function connect(name:string){const b=mineflayer.createBot({host:'127.0.0.1',port:9999,username:name});bots.push(b);await new Promise<void>((res,rej)=>{b.once('spawn',res);b.once('error',rej);b.once('kicked',r=>rej(new Error(String(r))));});await b.waitForChunksToLoad();return b;}
async function teleport(b:mineflayer.Bot,p:Vec3){
  await new BoundedTeleportService(b).selfTo(p.floored());
}
async function run(){design();const b=await connect('AnatomiaBuilder');console.log(JSON.stringify({stage:'connected',version:b.version}));console.log(JSON.stringify({players:Object.keys(b.players),position:b.entity.position}));await new BoundedTeleportService(b).selfToPlayer('aldeano_');const player=b.players[Object.keys(b.players).find(n=>n.toLowerCase()==='aldeano_')??'']?.entity;if(!player||b.entity.position.distanceTo(player.position)>5)throw Error('No se pudo confirmar teletransporte a aldeano_');const start=player.position.floored();console.log(JSON.stringify({stage:'at_player',position:start}));if(b.game.gameMode!=='creative')throw Error('Creative mode required');
 const o=start.offset(0,1,48);if(o.y+163>=b.game.height+b.game.minY)throw Error('Insufficient vertical world space');
 await teleport(b,o.offset(0,2,0));const bounds={from:{x:o.x-65,y:o.y,z:o.z-38},to:{x:o.x+65,y:o.y+163,z:o.z+38}};
 const result=await new BuildPreflight(b,2_000_000,45000).inspectBounds(bounds,'fast');console.log(JSON.stringify({stage:'preflight',...result,origin:o}));
 const ops=operations(o);writeFileSync(new URL('../artifacts/anatomy-build-plan.json', import.meta.url),JSON.stringify({origin:o,blocks:vox.size,labels,verifyAfterBuild:true,visualReview:false,operations:ops}));
 await teleport(b,o.offset(-68,5,0));for(let i=1;i<=2;i++){const w=await connect(`AnatomiaWork${i}`);await teleport(w,o.offset(-68,5,i*3));}
 let report=0;await new ParallelFastExecutor(bots).execute(ops,{commandsPerTick:6,onProgress:(n,total)=>{if(n-report>=700||n===total){report=n;console.log(JSON.stringify({stage:'building',commands:n,total}));}}});
 // Bounded text-display operations: no arbitrary command tool exposed.
 for(const {p,text}of labels){const pos=o.offset(...p as [number,number,number]);const component=JSON.stringify({text,color:'black'});const nbt=`{Tags:["anatomy_education"],billboard:"center",background:2003202047,line_width:300,text:${JSON.stringify(component)},transformation:{scale:[1.8f,1.8f,1.8f]}}`;b.chat(`/summon minecraft:text_display ${pos.x} ${pos.y} ${pos.z} ${nbt}`);await b.waitForTicks(1);}
 await teleport(b,o.offset(0,165,0));await b.waitForTicks(10);let correct=0;const repair:FastCommandOperation[]=[];for(const [k,name]of vox){const p=o.offset(...k.split(',').map(Number) as [number,number,number]);const block=b.blockAt(p);if(!block)throw Error(`SITE_UNAVAILABLE during verification ${p}`);if(block.name===name.split('[')[0])correct++;else repair.push({type:'setblock',position:{x:p.x,y:p.y,z:p.z},block:name});}
 if(repair.length){console.log(JSON.stringify({stage:'repair',differences:repair.length}));await new ParallelFastExecutor(bots).execute(repair,{commandsPerTick:6});await b.waitForTicks(10);}
 let finalCorrect=0;for(const [k,name]of vox){const p=o.offset(...k.split(',').map(Number) as [number,number,number]);if(b.blockAt(p)?.name===name.split('[')[0])finalCorrect++;}
await finalizeVoxels(b,vox,o,{mode:'fast'});
 const resultFinal={origin:o,dimensions:[131,164,77],blocks:vox.size,initialCorrect:correct,finalCorrect,labels:labels.length,visualReview:false};writeFileSync(new URL('../artifacts/anatomy-build-result.json', import.meta.url),JSON.stringify(resultFinal,null,2));console.log(JSON.stringify({stage:'completed',...resultFinal}));if(finalCorrect!==vox.size)throw Error('Unresolved structural differences');
}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{for(const b of bots)b.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});


