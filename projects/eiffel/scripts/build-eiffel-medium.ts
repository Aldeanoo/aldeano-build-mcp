#!/usr/bin/env tsx

import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { BuildService } from '../../../src/build/build-service.js';
import type { BlockPlacement, BlockPosition } from '../../../src/build/build-types.js';
import { buildLine } from '../../../src/build/primitives/line.js';
import { buildFloor } from '../../../src/build/primitives/floor.js';

const { pathfinder } = pathfinderPkg;
const host = process.env.MC_HOST ?? '127.0.0.1';
const port = Number(process.env.MC_PORT ?? 9999);
const username = process.env.MC_USERNAME ?? 'BenchmarkBot';
const bot = mineflayer.createBot({ host, port, username, plugins: { pathfinder } });

function eiffelTower(): BlockPlacement[] {
  const blocks: BlockPlacement[] = [];
  const steel = 'polished_blackstone_bricks';
  const lattice = 'iron_bars';
  const platform = 'smooth_stone';
  const addLine = (from: BlockPosition, to: BlockPosition, block = steel, section = 'structure') => {
    blocks.push(...buildLine(from, to, block).map((placement) => ({ ...placement, section })));
  };

  const legs = [
    [{ x: 2, y: 0, z: 2 }, { x: 6, y: 12, z: 6 }, { x: 9, y: 25, z: 9 }, { x: 11, y: 35, z: 11 }],
    [{ x: 22, y: 0, z: 2 }, { x: 18, y: 12, z: 6 }, { x: 15, y: 25, z: 9 }, { x: 13, y: 35, z: 11 }],
    [{ x: 2, y: 0, z: 22 }, { x: 6, y: 12, z: 18 }, { x: 9, y: 25, z: 15 }, { x: 11, y: 35, z: 13 }],
    [{ x: 22, y: 0, z: 22 }, { x: 18, y: 12, z: 18 }, { x: 15, y: 25, z: 15 }, { x: 13, y: 35, z: 13 }]
  ];

  for (const leg of legs) {
    for (let segment = 0; segment < leg.length - 1; segment += 1) {
      addLine(leg[segment], leg[segment + 1], steel, 'inclined legs');
      addLine({ ...leg[segment], y: leg[segment].y + 1 }, { ...leg[segment + 1], y: leg[segment + 1].y + 1 }, steel, 'inclined legs');
    }
    const foot = leg[0];
    blocks.push(...buildFloor({ x: foot.x - 1, y: 0, z: foot.z - 1 }, { x: foot.x + 1, y: 0, z: foot.z + 1 }, steel).map((placement) => ({ ...placement, category: 'foundation' as const, section: 'feet' })));
  }

  const frames = [
    { y: 4, min: 3, max: 21 }, { y: 8, min: 5, max: 19 },
    { y: 16, min: 7, max: 17 }, { y: 21, min: 8, max: 16 },
    { y: 28, min: 10, max: 14 }, { y: 32, min: 10, max: 14 }
  ];
  for (const frame of frames) {
    addLine({ x: frame.min, y: frame.y, z: frame.min }, { x: frame.max, y: frame.y, z: frame.min }, lattice, 'lattice frames');
    addLine({ x: frame.min, y: frame.y, z: frame.max }, { x: frame.max, y: frame.y, z: frame.max }, lattice, 'lattice frames');
    addLine({ x: frame.min, y: frame.y, z: frame.min }, { x: frame.min, y: frame.y, z: frame.max }, lattice, 'lattice frames');
    addLine({ x: frame.max, y: frame.y, z: frame.min }, { x: frame.max, y: frame.y, z: frame.max }, lattice, 'lattice frames');
  }

  for (let index = 0; index < frames.length - 1; index += 1) {
    const a = frames[index]; const b = frames[index + 1];
    addLine({ x: a.min, y: a.y, z: a.min }, { x: b.max, y: b.y, z: b.min }, lattice, 'cross braces');
    addLine({ x: a.max, y: a.y, z: a.min }, { x: b.min, y: b.y, z: b.min }, lattice, 'cross braces');
    addLine({ x: a.min, y: a.y, z: a.max }, { x: b.max, y: b.y, z: b.max }, lattice, 'cross braces');
    addLine({ x: a.max, y: a.y, z: a.max }, { x: b.min, y: b.y, z: b.max }, lattice, 'cross braces');
  }

  for (let offset = -8; offset <= 8; offset += 1) {
    const y = 2 + Math.round(7 * (1 - (offset / 8) ** 2));
    blocks.push({ position: { x: 12 + offset, y, z: 3 }, block: steel, category: 'structural', section: 'arches' });
    blocks.push({ position: { x: 12 + offset, y, z: 21 }, block: steel, category: 'structural', section: 'arches' });
    blocks.push({ position: { x: 3, y, z: 12 + offset }, block: steel, category: 'structural', section: 'arches' });
    blocks.push({ position: { x: 21, y, z: 12 + offset }, block: steel, category: 'structural', section: 'arches' });
  }

  blocks.push(...buildFloor({ x: 5, y: 12, z: 5 }, { x: 19, y: 12, z: 19 }, platform).map((placement) => ({ ...placement, section: 'first platform' })));
  blocks.push(...buildFloor({ x: 8, y: 25, z: 8 }, { x: 16, y: 25, z: 16 }, platform).map((placement) => ({ ...placement, section: 'second platform' })));
  blocks.push(...buildFloor({ x: 10, y: 35, z: 10 }, { x: 14, y: 35, z: 14 }, platform).map((placement) => ({ ...placement, section: 'observation deck' })));

  for (let y = 36; y <= 39; y += 1) {
    addLine({ x: 11, y, z: 11 }, { x: 13, y, z: 11 }, steel, 'upper tower');
    addLine({ x: 11, y, z: 13 }, { x: 13, y, z: 13 }, steel, 'upper tower');
    addLine({ x: 11, y, z: 12 }, { x: 11, y, z: 12 }, steel, 'upper tower');
    addLine({ x: 13, y, z: 12 }, { x: 13, y, z: 12 }, steel, 'upper tower');
  }
  addLine({ x: 12, y: 40, z: 12 }, { x: 12, y: 45, z: 12 }, lattice, 'spire');
  blocks.push({ position: { x: 12, y: 46, z: 12 }, block: 'lightning_rod', category: 'decoration', section: 'spire' });

  const unique = new Map<string, BlockPlacement>();
  for (const block of blocks) unique.set(`${block.position.x},${block.position.y},${block.position.z}`, block);
  return [...unique.values()];
}

async function run(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out connecting to ${host}:${port}`)), 15_000);
    bot.once('spawn', () => { clearTimeout(timeout); resolve(); });
    bot.once('error', (error) => { clearTimeout(timeout); reject(error); });
    bot.once('kicked', (reason) => { clearTimeout(timeout); reject(new Error(`Kicked: ${JSON.stringify(reason)}`)); });
  });
  await bot.waitForChunksToLoad();
  const current = bot.entity.position.floored();
  const origin = { x: current.x + 30, y: current.y, z: current.z + 10 };
  const placements = eiffelTower().map((placement) => ({
    ...placement,
    position: { x: origin.x + placement.position.x, y: origin.y + placement.position.y, z: origin.z + placement.position.z }
  }));
  const service = new BuildService(bot, {
    mode: 'fast', fastModeEnabled: true, fastCommandIntervalMs: 12,
    concurrency: 1, batchSize: 100, maxBlocks: 5_000, maxQueue: 5_000,
    retryCount: 1, verify: false, autoRepair: false
  });
  const result = await service.executePlacements('eiffel-tower-medium', placements, 'fast');
  console.log(JSON.stringify({ ...result, origin, dimensions: { x: 25, y: 47, z: 25 } }));
}

run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => bot.quit());
