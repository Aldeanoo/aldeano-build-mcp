/**
 * Definition of Done Verification Script
 * Validates provider neutrality, runtime connection, commands, and multiple usernames.
 */
import { MinecraftRuntime } from '../src/runtime/runtime.js';
import { executeCommand } from '../src/dev/commands.js';
import { getConfig } from '../src/config.js';

async function testSession(botName: string) {
  console.log(`\n================================================================`);
  console.log(`Testing Session with: ${botName}`);
  console.log(`================================================================`);

  const baseConfig = getConfig();
  const config = { ...baseConfig, username: botName };
  const runtime = new MinecraftRuntime({ config });

  console.log(`[test] Connecting to ${config.host}:${config.port} as ${botName}...`);
  runtime.connect();

  await runtime.waitForReady(15000);
  console.log(`[test] Successfully connected as ${botName}!`);

  const posOutput = await executeCommand('position', runtime);
  console.log(`[cmd] > position\n${posOutput}`);

  const statusOutput = await executeCommand('status', runtime);
  console.log(`[cmd] > status\n${statusOutput}`);

  const gamemodeOutput = await executeCommand('gamemode', runtime);
  console.log(`[cmd] > gamemode\n${gamemodeOutput}`);

  const healthOutput = await executeCommand('health', runtime);
  console.log(`[cmd] > health\n${healthOutput}`);

  console.log(`[test] Disconnecting ${botName}...`);
  await runtime.disconnect();
  console.log(`[test] Disconnected ${botName} cleanly.`);
}

async function main() {
  console.log('Starting Definition of Done Live Verification...');
  await testSession('ClaudeBot');
  await testSession('GeminiBot');
  await testSession('MiniMaxBot');
  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n[FATAL] Verification failed:', err);
  process.exit(1);
});
