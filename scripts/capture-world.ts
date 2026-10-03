#!/usr/bin/env tsx

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
import { WorldApiService } from '../src/world/world-service.js';
import { WorldScreenshotRenderer } from '../src/world/world-screenshot.js';

const { pathfinder } = pathfinderPkg;
const host = process.env.MC_HOST ?? '127.0.0.1';
const port = Number(process.env.MC_PORT ?? 25565);
const username = process.env.MC_USERNAME ?? 'ScreenshotBot';
const outputArg = process.argv.find((value) => value.startsWith('--output='))?.slice('--output='.length);
const output = outputArg
  ? path.resolve(outputArg)
  : fileURLToPath(new URL('../artifacts/world/aldeano-world.png', import.meta.url));
const bot = mineflayer.createBot({ host, port, username, plugins: { pathfinder } });

bot.once('spawn', async () => {
  await bot.waitForChunksToLoad();
  await bot.waitForTicks(4);
  const current = bot.entity.position.floored();
  const bounds = {
    from: { x: current.x + 3, y: current.y - 1, z: current.z - 3 },
    to: { x: current.x + 26, y: current.y + 14, z: current.z + 12 }
  };
  const screenshot = new WorldScreenshotRenderer(new WorldApiService(bot, 65_536)).capture(bounds, 960, 720);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, screenshot.data);
  console.log(JSON.stringify({ success: true, output, bounds, renderedBlocks: screenshot.renderedBlocks, bytes: screenshot.data.length }));
  bot.quit();
});

bot.once('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

setTimeout(() => {
  if (!bot.entity) {
    console.error(`Timed out connecting to ${host}:${port}`);
    bot.quit();
    process.exitCode = 1;
  }
}, 15_000).unref();
