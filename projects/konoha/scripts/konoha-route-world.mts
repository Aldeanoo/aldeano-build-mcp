import mineflayer from 'mineflayer';
import {Vec3} from 'vec3';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {design,vox,structures,W,D,key} from './konoha-design.mts';
import {BoundedTeleportService} from '../../../src/services/bounded-teleport-service.js';
design();const N=W*D,seen=new Uint8Array(N*85),parent=new Int32Array(N*85),queue=new Int32Array(N*85),encode=(x:number,y:number,z:number)=>(y*D+z)*W+x;
const open=(x:number,y:number,z:number)=>{const b=vox.get(key(x,y,z));return !b||b.includes('_door[')&&b.includes('open=true')||b.startsWith('ladder')||b==='flower_pot';};
const walk=(x:number,y:number,z:number)=>{if(x<0||x>=W||z<0||z>=D||y<1||y>=83)return false;const floor=vox.get(key(x,y-1,z));return !!floor&&!floor.startsWith('water')&&!floor.includes('leaves')&&open(x,y,z)&&open(x,y+1,z);};
let at=0,count=0;const start=encode(192,7,444);queue[count++]=start;seen[start]=1;
while(at<count){const id=queue[at++],x=id%W,z=Math.floor(id/W)%D,y=Math.floor(id/N);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])for(const dy of [0,1,-1]){const X=x+dx,Y=y+dy,Z=z+dz;if(X<0||X>=W||Z<0||Z>=D||Y<1||Y>=83)continue;const k=encode(X,Y,Z);if(!seen[k]&&walk(X,Y,Z)){seen[k]=1;parent[k]=id;queue[count++]=k;}}}
const witnesses=new Set<number>([start]);let destinations=0;
function collect(position:number[]){let id=encode(...position as [number,number,number]);if(!seen[id])throw Error(`Unreachable destination ${position}`);destinations++;while(id!==start){witnesses.add(id);id=parent[id];}}
for(const s of structures){if(s.entrance)collect(s.entrance as number[]);if(s.interior){const p=s.interior as number[];collect(p);for(let f=1;f<Number(s.stories??1);f++)collect([p[0],p[1]+f*(s.id==='hokage_complex'?11:7),p[2]]);}}
const tiles=new Map<string,number[]>();for(const id of witnesses){const x=id%W,z=Math.floor(id/W)%D,k=`${Math.floor(x/48)*48},${Math.floor(z/48)*48}`,r=tiles.get(k)??[];r.push(id);tiles.set(k,r);}
const manifest=JSON.parse(readFileSync(new URL('../artifacts/konoha-manifest.json', import.meta.url),'utf8')),bot=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'KonohaRouteQA'});
async function run(){await new Promise<void>((res,rej)=>{bot.once('spawn',res);bot.once('error',rej);});let verified=0;
for(const [k,ids]of tiles){const [tx,tz]=k.split(',').map(Number);await new BoundedTeleportService(bot).selfTo({x:manifest.origin.x+tx+23,y:manifest.origin.y+200,z:manifest.origin.z+tz+23});
for(const id of ids){const x=id%W,z=Math.floor(id/W)%D,y=Math.floor(id/N);for(const dy of [0,1]){const p=new Vec3(manifest.origin.x+x,manifest.origin.y+y+dy,manifest.origin.z+z),b=bot.blockAt(p);if(!b)throw Error(`Unreadable route ${p}`);const clear=['air','cave_air','void_air','ladder','flower_pot'].includes(b.name)||b.name.endsWith('_door')&&b.getProperties().open===true;if(!clear)throw Error(`Route obstructed ${p}: ${b.name}`);}const floor=bot.blockAt(new Vec3(manifest.origin.x+x,manifest.origin.y+y-1,manifest.origin.z+z));const expected=vox.get(key(x,y-1,z))?.split('[')[0];if(floor?.name!==expected&&!(['grass_block','dirt'].includes(expected??'')&&['grass_block','dirt'].includes(floor?.name??'')))throw Error('Route support changed '+[x,y,z]+' expected '+expected+' actual '+floor?.name);verified++;}
console.log(JSON.stringify({stage:'route_world_verified',cells:verified,total:witnesses.size}));}
const result=JSON.parse(readFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),'utf8'));result.worldRouteCellsVerified=verified;result.accessibleDestinationsVerified=destinations;writeFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),JSON.stringify(result,null,2));writeFileSync(new URL('../artifacts/konoha-world-route-audit.json', import.meta.url),JSON.stringify({verifiedCells:verified,verifiedDestinations:destinations,failures:0,visualReview:false},null,2));console.log(JSON.stringify({stage:'routes_completed',verified,destinations}));}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{bot.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});

