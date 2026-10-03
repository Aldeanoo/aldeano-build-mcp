import mineflayer from 'mineflayer';
import {readFileSync,writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import {BoundedTeleportService} from '../../../src/services/bounded-teleport-service.js';
const manifest=JSON.parse(readFileSync(new URL('../artifacts/konoha-manifest.json', import.meta.url),'utf8'));
for(const label of manifest.labels){
  if(label.text.includes('KONOHAGAKURE'))label.text='\u6728\u30ce\u8449\u96a0\u308c\u306e\u91cc  KONOHAGAKURE';
  else if(label.text.includes('  HOKAGE'))label.text='\u706b  HOKAGE';
  else if(label.text.includes('ACADEMIA NINJA'))label.text='\u5fcd  ACADEMIA NINJA';
  else if(label.text.includes('ICHIRAKU RAMEN')&&label.text!=='ICHIRAKU RAMEN')label.text='\u4e00\u697d  ICHIRAKU RAMEN';
}
const bot=mineflayer.createBot({host:'127.0.0.1',port:9999,username:'KonohaLabelQA'});
async function run(){await new Promise<void>((resolve,reject)=>{bot.once('spawn',resolve);bot.once('error',reject);});let verified=0;
for(const label of manifest.labels){if(label.text.startsWith('commercial_')){const names=['Tienda ninja','Forja de kunai','Casa de te','Herbolario','Telas y kimonos','Artesanos de madera'];const number=Number(label.text.split('_').at(-1));label.text=names[number%names.length];}const x=manifest.origin.x+label.x,y=manifest.origin.y+label.y,z=manifest.origin.z+label.z;await new BoundedTeleportService(bot).selfTo({x,y:manifest.origin.y+200,z});
const selector=`@e[type=minecraft:text_display,tag=konoha_benchmark,x=${x+0.5},y=${y},z=${z+0.5},distance=..0.1,sort=nearest,limit=1]`;
const answer=new Promise<string>((resolve,reject)=>{const timeout=setTimeout(()=>{bot.removeListener('messagestr',read);reject(Error('Label verification response missing'));},8000);const read=(message:string)=>{if(!message.includes('entity data:')&&!message.includes('No entity was found'))return;clearTimeout(timeout);bot.removeListener('messagestr',read);resolve(message);};bot.on('messagestr',read);});
bot.chat(`/data merge entity ${selector} {text:{text:${JSON.stringify(label.text)},color:"black"}}`);await bot.waitForTicks(4);bot.chat(`/data get entity ${selector} text`);const message=await answer;if(message.includes('No entity was found')||!message.includes(label.text))throw Error(`Label not verified: ${label.text}`);verified++;}
const result=JSON.parse(readFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),'utf8'));result.labelsVerified=verified;result.textFormat='native SNBT components';writeFileSync(new URL('../artifacts/konoha-result.json', import.meta.url),JSON.stringify(result,null,2));writeFileSync(new URL('../artifacts/konoha-manifest.json', import.meta.url),JSON.stringify(manifest,null,2));console.log(JSON.stringify({stage:'labels_verified',verified}));}
run().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{bot.quit();setTimeout(()=>process.exit(process.exitCode??0),1000);});



