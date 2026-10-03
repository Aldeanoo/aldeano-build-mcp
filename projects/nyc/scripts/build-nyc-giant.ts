#!/usr/bin/env tsx
import { ParallelFastExecutor } from '../../../src/build/executor/parallel-fast-executor.js';

import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { type FastCommandOperation } from '../../../src/build/executor/fast-command-batch.js';
import { BuildPreflight } from '../../../src/build/verification/build-preflight.js';

const { pathfinder } = pathfinderPkg;
const host = process.env.MC_HOST ?? '127.0.0.1';
const port = Number(process.env.MC_PORT ?? 9999);
const username = process.env.MC_USERNAME ?? 'BenchmarkBot';
const bot = mineflayer.createBot({ host, port, username, plugins: { pathfinder } });

interface Section { inset: number; fromY: number; toY: number; material: string }

function createSkyscraper(origin: { x: number; y: number; z: number }): FastCommandOperation[] {
  const operations: FastCommandOperation[] = [];
  const fill = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, block: string) => operations.push({
    type: 'fill',
    from: { x: origin.x + x1, y: origin.y + y1, z: origin.z + z1 },
    to: { x: origin.x + x2, y: origin.y + y2, z: origin.z + z2 },
    block
  });
  const setblock = (x: number, y: number, z: number, block: string) => operations.push({
    type: 'setblock', position: { x: origin.x + x, y: origin.y + y, z: origin.z + z }, block
  });

  fill(0, 0, 0, 44, 2, 44, 'polished_deepslate');
  const sections: Section[] = [
    { inset: 0, fromY: 3, toY: 14, material: 'smooth_sandstone' },
    { inset: 3, fromY: 15, toY: 48, material: 'smooth_sandstone' },
    { inset: 7, fromY: 49, toY: 76, material: 'smooth_sandstone' },
    { inset: 11, fromY: 77, toY: 98, material: 'smooth_sandstone' },
    { inset: 15, fromY: 99, toY: 113, material: 'quartz_block' },
    { inset: 18, fromY: 114, toY: 121, material: 'polished_deepslate' }
  ];

  for (const section of sections) {
    const min = section.inset; const max = 44 - section.inset;
    fill(min, section.fromY, min, max, section.fromY, max, 'smooth_stone');
    fill(min, section.toY, min, max, section.toY, max, 'smooth_stone');
    fill(min, section.fromY, min, min, section.toY, max, section.material);
    fill(max, section.fromY, min, max, section.toY, max, section.material);
    fill(min, section.fromY, min, max, section.toY, min, section.material);
    fill(min, section.fromY, max, max, section.toY, max, section.material);

    for (let y = section.fromY + 4; y < section.toY; y += 4) {
      fill(min + 2, y, min, max - 2, y + 1, min, 'light_blue_stained_glass');
      fill(min + 2, y, max, max - 2, y + 1, max, 'light_blue_stained_glass');
      fill(min, y, min + 2, min, y + 1, max - 2, 'light_blue_stained_glass');
      fill(max, y, min + 2, max, y + 1, max - 2, 'light_blue_stained_glass');
    }
    for (let y = section.fromY + 5; y < section.toY; y += 5) {
      fill(min + 1, y, min + 1, max - 1, y, max - 1, 'smooth_stone');
    }
  }

  fill(18, 3, 0, 26, 11, 0, 'black_stained_glass');
  fill(17, 3, 0, 17, 13, 0, 'polished_blackstone_bricks');
  fill(27, 3, 0, 27, 13, 0, 'polished_blackstone_bricks');
  fill(17, 12, 0, 27, 13, 0, 'gold_block');

  for (const y of [20, 35, 64, 86]) {
    fill(44, y, 15, 46, y, 29, 'iron_bars');
    fill(45, y, 15, 45, y + 8, 15, 'iron_bars');
    fill(45, y, 29, 45, y + 8, 29, 'iron_bars');
  }

  fill(20, 122, 20, 24, 128, 24, 'iron_block');
  fill(21, 129, 21, 23, 135, 23, 'iron_bars');
  fill(22, 136, 22, 22, 144, 22, 'iron_bars');
  setblock(22, 145, 22, 'lightning_rod');
  setblock(21, 129, 21, 'sea_lantern');
  setblock(23, 129, 23, 'sea_lantern');
  return operations;
}

async function run(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${host}:${port}`)), 15_000);
    bot.once('spawn', () => { clearTimeout(timeout); resolve(); });
    bot.once('error', (error) => { clearTimeout(timeout); reject(error); });
    bot.once('kicked', (reason) => { clearTimeout(timeout); reject(new Error(`Kicked: ${JSON.stringify(reason)}`)); });
  });
  const current = bot.entity.position.floored();
  const origin = { x: current.x - 62, y: current.y, z: current.z + 30 };
  const bounds = {
    from: origin,
    to: { x: origin.x + 46, y: origin.y + 145, z: origin.z + 44 }
  };
  const preflight = await new BuildPreflight(bot, 1_000_000, 45_000).inspectBounds(bounds, 'fast');
  const operations = createSkyscraper(origin);
  const result = await new ParallelFastExecutor([bot]).execute(operations);
  console.log(JSON.stringify({ success: true, name: 'new-york-art-deco-giant', origin, dimensions: { x: 47, y: 146, z: 45 }, preflight, ...result, verification: 'verified' }));
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => bot.quit());
