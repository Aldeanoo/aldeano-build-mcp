import mineflayer from 'mineflayer';
import { Vec3 } from 'vec3';

const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'GroundScan', auth: 'offline', connectTimeout: 30000 });
b.once('spawn', () => {
  console.log('SPAWN:', JSON.stringify(b.entity.position));
  const started = Date.now();
  const poll = setInterval(() => {
    // Find the surface column at the bot's own spawn area.
    const p = b.entity.position;
    let found = -1, name = 'none';
    for (let y = 120; y >= -64; y--) {
      const blk = b.blockAt(new Vec3(Math.floor(p.x), y, Math.floor(p.z)));
      if (blk && !['air', 'cave_air', 'void_air'].includes(blk.name)) { found = y; name = blk.name; break; }
    }
    console.log('SUPERFICIE_EN_SPAWN: y=' + found + ' bloque=' + name);
    // Sample a few spots to see if the world is flat and where.
    for (const [x, z] of [[0, 0], [100, 100], [2500, 2500]] as const) {
      let f = -1, n = 'none';
      for (let y = 120; y >= -64; y--) {
        const blk = b.blockAt(new Vec3(x, y, z));
        if (blk && !['air', 'cave_air', 'void_air'].includes(blk.name)) { f = y; n = blk.name; break; }
      }
      console.log(`  (${x},${z}) -> y=${f} ${n}`);
    }
    if (Date.now() - started > 2000) {
      clearInterval(poll);
      b.quit();
      setTimeout(() => process.exit(0), 300);
    }
  }, 1000);
});
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 40000);
