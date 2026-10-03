#!/usr/bin/env tsx
import {writeFileSync, mkdirSync} from 'node:fs';
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
import mineflayer from 'mineflayer';
import { BoundedTeleportService } from '../../../src/services/bounded-teleport-service.js';
import { WorldApiService } from '../../../src/world/world-service.js';
import { WorldScreenshotRenderer } from '../../../src/world/world-screenshot.js';
import { GROUND_Y, ORIGIN, HULL_X0, HULL_LEN, HULL_ZC } from './titanic-design.mts';

const bot = mineflayer.createBot({ host: '127.0.0.1', port: 9999, username: 'CaptureBot', auth: 'offline', connectTimeout: 30000 });

bot.once('spawn', async () => {
  const park = { x: ORIGIN.x + HULL_X0 + 60, y: GROUND_Y + 45, z: ORIGIN.z + HULL_ZC + 90 };
  await new BoundedTeleportService(bot).selfTo(park);

  const shots: Array<[string, { x: number; y: number; z: number }, { x: number; y: number; z: number }]> = [
    ['titanic-1-proa', { x: ORIGIN.x + HULL_X0, y: GROUND_Y, z: ORIGIN.z + HULL_ZC - 18 }, { x: ORIGIN.x + HULL_X0 + 62, y: GROUND_Y + 40, z: ORIGIN.z + HULL_ZC + 18 }],
    ['titanic-2-centro', { x: ORIGIN.x + HULL_X0 + 66, y: GROUND_Y, z: ORIGIN.z + HULL_ZC - 18 }, { x: ORIGIN.x + HULL_X0 + 132, y: GROUND_Y + 40, z: ORIGIN.z + HULL_ZC + 18 }],
    ['titanic-3-popa', { x: ORIGIN.x + HULL_X0 + 196, y: GROUND_Y, z: ORIGIN.z + HULL_ZC - 18 }, { x: ORIGIN.x + HULL_X0 + 250, y: GROUND_Y + 40, z: ORIGIN.z + HULL_ZC + 18 }],
  ];

  // maxScanBlocks must cover the shot volume (63 x 41 x 37 = 95,571 > the 65,536 default).
  const renderer = new WorldScreenshotRenderer(new WorldApiService(bot, 500_000), 200_000);
  for (const [name, from, to] of shots) {
    const shot = renderer.capture({ from, to }, 1024, 512);
    const out = new URL(`../artifacts/${name}.png`, import.meta.url);
    writeFileSync(out, shot.data);
    console.log(JSON.stringify({ out, renderedBlocks: shot.renderedBlocks, bytes: shot.data.length }));
  }
  bot.quit();
  setTimeout(() => process.exit(0), 500);
});

bot.once('error', (e: Error) => { console.error('ERR:', e.message); process.exit(1); });
setTimeout(() => { console.error('TIMEOUT'); process.exit(2); }, 90000);
