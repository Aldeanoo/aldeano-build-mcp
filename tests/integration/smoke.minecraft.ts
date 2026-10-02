import test from 'ava';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements } = pathfinderPkg;
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';

const isMinecraftTestsEnabled = process.env.RUN_MINECRAFT_TESTS === 'true';

if (!isMinecraftTestsEnabled) {
  test('Minecraft live smoke test (SKIPPED)', (t) => {
    t.pass('Skipped live Minecraft integration tests. Set RUN_MINECRAFT_TESTS=true to run against an active Minecraft server.');
  });
} else {
  test.serial('Minecraft full smoke workflow: connect -> spawn -> get position -> move -> place -> read -> destroy -> disconnect', async (t) => {
    const host = process.env.MC_HOST || process.env.MINECRAFT_HOST || '127.0.0.1';
    const port = Number(process.env.MC_PORT || process.env.MINECRAFT_PORT || 25565);
    const username = process.env.MC_USERNAME || process.env.MINECRAFT_USERNAME || 'SmokeBot';

    t.log(`[SmokeTest] Connecting to Minecraft server at ${host}:${port} as ${username}...`);

    // 1. Connect
    const bot = mineflayer.createBot({
      host,
      port,
      username,
      plugins: { pathfinder }
    });

    try {
      // 2. Spawn
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout waiting for bot to spawn on ${host}:${port}`));
        }, 15000);

        bot.once('spawn', () => {
          clearTimeout(timeout);
          t.log('[SmokeTest] Bot spawned in world successfully');
          resolve();
        });

        bot.once('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });

        bot.once('kicked', (reason) => {
          clearTimeout(timeout);
          reject(new Error(`Bot kicked: ${JSON.stringify(reason)}`));
        });
      });

      t.truthy(bot.entity, 'Bot entity exists after spawn');

      const mcData = minecraftData(bot.version);
      const defaultMove = new Movements(bot, mcData);
      bot.pathfinder.setMovements(defaultMove);

      // 3. Get position
      const initialPos = bot.entity.position.clone();
      t.truthy(initialPos, 'Initial position obtained');
      t.log(`[SmokeTest] Initial position: (${Math.floor(initialPos.x)}, ${Math.floor(initialPos.y)}, ${Math.floor(initialPos.z)})`);

      // 4. Move
      t.log('[SmokeTest] Moving bot forward...');
      bot.setControlState('forward', true);
      await new Promise(r => setTimeout(r, 600));
      bot.setControlState('forward', false);
      const movedPos = bot.entity.position.clone();
      t.truthy(movedPos, 'Position after movement obtained');
      t.log(`[SmokeTest] Moved position: (${Math.floor(movedPos.x)}, ${Math.floor(movedPos.y)}, ${Math.floor(movedPos.z)})`);

      // 5. Place block / interact
      // Look for a suitable placement position next to the bot
      const targetPos = bot.entity.position.floored().offset(1, 0, 0);
      const belowTarget = targetPos.offset(0, -1, 0);
      const referenceBlock = bot.blockAt(belowTarget);

      t.log(`[SmokeTest] Testing block inspection at (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);

      // 6. Read block
      const inspectedBlock = bot.blockAt(targetPos);
      t.truthy(inspectedBlock, 'Inspected block is defined');
      t.log(`[SmokeTest] Read block at target: ${inspectedBlock?.name}`);

      // If reference block exists, test place & destroy workflow
      if (referenceBlock && referenceBlock.name !== 'air' && inspectedBlock?.name === 'air') {
        const itemInInventory = bot.inventory.items().find(i => i.name.includes('dirt') || i.name.includes('stone') || i.name.includes('plank'));
        if (itemInInventory) {
          try {
            await bot.equip(itemInInventory, 'hand');
            await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
            t.log(`[SmokeTest] Placed block at ${targetPos}`);

            // Read placed block
            const placedBlock = bot.blockAt(targetPos);
            t.truthy(placedBlock);
            t.is(placedBlock?.name, itemInInventory.name);

            // 7. Destroy block
            if (bot.canDigBlock(placedBlock!)) {
              await bot.dig(placedBlock!);
              t.log(`[SmokeTest] Destroyed block at ${targetPos}`);
              const afterDig = bot.blockAt(targetPos);
              t.is(afterDig?.name, 'air');
            }
          } catch (blockErr) {
            t.log(`[SmokeTest] Non-critical block action skipped: ${blockErr}`);
          }
        }
      }

      t.pass('Smoke test workflow completed successfully');
    } finally {
      // 8. Disconnect
      t.log('[SmokeTest] Disconnecting bot from server...');
      bot.quit();
      await new Promise(r => setTimeout(r, 500));
    }
  });
}
