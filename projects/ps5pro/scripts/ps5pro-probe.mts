import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { Vec3 } from 'vec3';

const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'PS5ProScan', auth: 'offline', connectTimeout: 30000 });
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });

b.once('spawn', async () => {
  console.log('SPAWN:', JSON.stringify(b.entity.position), 'mode:', b.game.gameMode);
  // Candidate sites, well clear of the existing colossal build (x1335-1629, z458-631).
  const sites = [[2000, 2000], [2000, 1200], [2600, 2000], [2000, 800], [3000, 3000], [1500, 2200]] as const;
  for (const [cx, cz] of sites) {
    // Load the chunk by looking at it, then read the heightmap via a column probe.
    await new BoundedTeleportService(b).selfTo({x:cx,y:100,z:cz});
    const heights: number[] = [];
    const names = new Set<string>();
    let unreadable = 0;
    for (const [dx, dz] of [[0, 0], [-20, -37], [20, 37], [-20, 37], [20, -37], [0, -37], [0, 37], [-20, 0], [20, 0]] as const) {
      const x = cx + dx, z = cz + dz;
      let h: number | -1 = -1, nm = 'none';
      for (let y = 120; y >= -64; y--) {
        const blk = b.blockAt(new Vec3(x, y, z));
        if (!blk) { unreadable++; break; }
        if (!['air', 'cave_air', 'void_air'].includes(blk.name)) { h = y; nm = blk.name; names.add(nm); break; }
      }
      heights.push(h);
    }
    const min = Math.min(...heights), max = Math.max(...heights);
    console.log(`SITE (${cx},${cz}) heights=[${heights.join(',')}] flat=${max - min} surface=${[...names].join('|')} unreadable=${unreadable}`);
  }
  b.quit();
  setTimeout(() => process.exit(0), 300);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 180000);
