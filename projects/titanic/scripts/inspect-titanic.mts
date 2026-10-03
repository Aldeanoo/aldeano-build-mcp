import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { Vec3 } from 'vec3';
import { W, D, GROUND_Y, ORIGIN, HULL_X0, HULL_LEN, HULL_ZC, HULL_HB } from './titanic-design.mts';

const b = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'Inspector', auth: 'offline', connectTimeout: 30000 });
const w = (x: number, y: number, z: number) => new Vec3(ORIGIN.x + x, GROUND_Y + y, ORIGIN.z + z);
const name = (x: number, y: number, z: number) => { const k = b.blockAt(w(x, y, z)); return k ? k.name : 'unreadable'; };

b.once('spawn', async () => {
  await new BoundedTeleportService(b).selfTo({x:ORIGIN.x+200,y:GROUND_Y+70,z:ORIGIN.z+200});

  // Heightmap along the hull centreline: is the ship actually there?
  const heights: string[] = [];
  for (let x = HULL_X0; x < HULL_X0 + HULL_LEN; x += 15) {
    let top = -999;
    for (let y = 1; y <= 60; y++) { const n = name(x, y, HULL_ZC); if (n !== 'air' && n !== 'unreadable') { top = y; break; } }
    heights.push(`x${x}:${top}`);
  }
  console.log('TOP_CENTERLINE:', heights.join(' '));

  // Beam check at amidships: how wide is the ship at several heights?
  console.log('\nBEAM_AT_MIDSHIP (x=' + (HULL_X0 + 135) + '):');
  for (const y of [1, 5, 10, 15, 19, 20, 21, 25, 31]) {
    let lo = -1, hi = -1;
    for (let z = HULL_ZC - 40; z <= HULL_ZC + 40; z++) { if (name(HULL_X0 + 135, y, z) !== 'air') { if (lo < 0) lo = z; hi = z; } }
    console.log(`  y=${y}: ${lo < 0 ? 'AIR' : `z ${lo}..${hi} (ancho ${hi - lo + 1})`}`);
  }

  // Key features present?
  console.log('\nFEATURES:');
  const checks: [string, number, number, number][] = [
    ['proa_punta', HULL_X0 + 1, 1, HULL_ZC],
    ['casco_babor', HULL_X0 + 135, 10, HULL_ZC - 14],
    ['cubierta_principal', HULL_X0 + 135, 20, HULL_ZC],
    ['chimenea1', 134, 33, HULL_ZC],
    ['chimenea2', 156, 33, HULL_ZC],
    ['chimenea3', 178, 33, HULL_ZC],
    ['chimenea4_dummy', 200, 29, HULL_ZC],
    ['mastil_proa', 126, 45, HULL_ZC],
    ['boat_deck', 190, 32, HULL_ZC],
    ['popa', HULL_X0 + HULL_LEN - 2, 15, HULL_ZC],
  ];
  for (const [label, x, y, z] of checks) console.log(`  ${label}: ${name(x, y, z)}`);

  // Funnel height profile.
  console.log('\nALTURA_CHIMENEAS (x=134):');
  const prof: string[] = [];
  for (let y = 30; y <= 50; y++) { const n = name(134, y, HULL_ZC); prof.push(`${y}=${n}`); }
  console.log('  ' + prof.join(' '));

  const unread = (() => { let c = 0; for (let x = HULL_X0; x < HULL_X0 + HULL_LEN; x += 20) for (let y = 1; y <= 45; y += 4) if (name(x, y, HULL_ZC) === 'unreadable') c++; return c; })();
  console.log('\nUNREADABLE_SAMPLES:', unread);
  console.log('RESERVA:', W + 'x' + D, 'GROUND_Y=' + GROUND_Y, 'HULL halfbeam=' + HULL_HB);
  b.quit();
  setTimeout(() => process.exit(0), 400);
});
b.once('error', (e: Error) => { console.log('ERR:', e.message); process.exit(1); });
setTimeout(() => { console.log('TIMEOUT'); process.exit(2); }, 60000);
