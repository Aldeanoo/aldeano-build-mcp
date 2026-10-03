import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { Vec3 } from 'vec3';

const O = new Vec3(2000, 2, 2000);
const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'PS5ProView', auth: 'offline' });
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });

b.once('spawn', async () => {
  await b.waitForTicks(5);
  const shots: Array<[string, Vec3, number, number]> = [
    ['front', new Vec3(O.x, O.y + 60, O.z - 90), 1, 55],
    ['side', new Vec3(O.x + 95, O.y + 60, O.z), -90, 55],
    ['rear', new Vec3(O.x, O.y + 60, O.z + 90), 180, 55],
    ['top', new Vec3(O.x + 60, O.y + 150, O.z - 60), 40, 45],
  ];
  for (const [name, pos, yaw, pitch] of shots) {
    b.creative.startFlying();
    await new BoundedTeleportService(b).selfTo({x:pos.x,y:pos.y,z:pos.z});
    await b.look(Math.PI-yaw*Math.PI/180,-pitch*Math.PI/180,true);
    // Read a silhouette cross-section: solid columns at several heights.
    const rows: string[] = [];
    for (const y of [125, 115, 100, 80, 60, 40, 20, 8]) {
      let solid = 0, minx = 99, maxx = -99, minz = 99, maxz = -99;
      for (let x = -18; x <= 18; x++) for (let z = -36; z <= 36; z++) {
        const blk = b.blockAt(new Vec3(O.x + x, y, O.z + z));
        if (blk && !['air', 'cave_air', 'void_air'].includes(blk.name)) {
          solid++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
        }
      }
      rows.push(`y=${y} solid=${solid} x[${minx}..${maxx}] z[${minz}..${maxz}]`);
    }
    console.log(`VIEW ${name}: ` + rows.join(' | '));
  }
  b.quit();
  setTimeout(() => process.exit(0), 300);
});
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 240000);
