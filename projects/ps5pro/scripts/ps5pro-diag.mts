import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { Vec3 } from 'vec3';

const S = new Vec3(2000, 2, 2000);
const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'PS5Diag', auth: 'offline' });
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });
b.once('spawn', async () => {
  await new BoundedTeleportService(b).selfTo({x:S.x+10,y:S.y+70,z:S.z});
  for (const y of [0, 20, 40, 55, 60, 62, 70, 80, 120]) {
    const blk = b.blockAt(new Vec3(S.x, S.y + y, S.z));
    console.log(`y=${y} name=${blk ? blk.name : 'UNREADABLE'}`);
  }
  // What is actually around at the failure height?
  for (let dx = -44; dx <= 44; dx += 22) for (let dz = -104; dz <= 104; dz += 52) {
    const blk = b.blockAt(new Vec3(S.x + dx, S.y + 60, S.z + dz));
    console.log(`  (${dx},${dz}) -> ${blk ? blk.name : 'UNREADABLE'}`);
  }
  b.quit();
  setTimeout(() => process.exit(0), 300);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 120000);
