import test from 'ava';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { BuildService } from '../../src/build/build-service.js';
import { LetteringService } from '../../src/services/lettering/lettering-service.js';

if (process.env.RUN_MINECRAFT_TESTS !== 'true') {
  test('lettering Minecraft integration (SKIPPED)',t=>t.pass('Requires an isolated Minecraft server via Doctor.'));
} else {
  test.serial('lettering preserves accented text in signs, books, displays and block glyphs',async t=>{
    t.timeout(90000);
    const bot=mineflayer.createBot({host:process.env.MC_HOST ?? '127.0.0.1',port:Number(process.env.MC_PORT ?? 25565),username:'LetteringTestBot',plugins:{pathfinder:pathfinderPkg.pathfinder}});
    try {
      await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('Minecraft connection timeout')),15000);
        bot.once('spawn',()=>{clearTimeout(timer);resolve();});
        bot.once('error',error=>{clearTimeout(timer);reject(error);});
      });
      await bot.waitForChunksToLoad();
      const builds=new BuildService(bot,{mode:'fast',fastModeEnabled:true,checkpointDirectory:false});
      const service=new LetteringService(bot,builds);
      const base=bot.entity.position.floored().offset(50,8,70);
      const sign=await service.place({support:'sign',title:'Autor',body:'Antoine de Saint-Exupéry'},{origin:{x:base.x,y:base.y,z:base.z},facing:'north'});
      t.true(sign.verified);
      const display=await service.place({support:'display',title:'Dimensiones',body:'20,6 × 15,6 cm\nEdición de prueba'},{origin:{x:base.x+10,y:base.y,z:base.z},facing:'north'});
      t.true(display.verified);
      const book=await service.writeBook({support:'book',title:'Guía',body:'Árbol y niño.\nPáginas con información legible.'},0);
      t.true(book.verified);
      const letters=await service.place({support:'blocks',title:'Ñ'},{origin:{x:base.x+20,y:base.y,z:base.z},facing:'north'});
      t.true(letters.verified);
      t.true((await service.verify(sign.labelId)).verified);
      t.true((await service.verify(display.labelId)).verified);
    }finally{bot.quit();}
  });
}
