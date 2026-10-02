/**
 * Dev Shell Command Definitions & Dispatcher
 * Directly invokes services in src/services/ with zero duplicated Minecraft action logic.
 */

import type { MinecraftRuntime } from '../runtime/runtime.js';
import {
  formatSuccess,
  formatError,
  formatInfo,
  formatCoordinates,
  formatBlock,
  formatFoundBlocks,
  formatInventory,
  formatStatus,
  formatHealth,
  formatHelp,
} from './formatter.js';

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  execute: (args: string[], runtime: MinecraftRuntime) => Promise<string>;
}

export function parseCommandLine(line: string): { command: string; args: string[] } {
  const trimmed = line.trim();
  if (!trimmed) return { command: '', args: [] };

  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(trimmed)) !== null) {
    if (match[1] !== undefined) {
      tokens.push(match[1]);
    } else if (match[2] !== undefined) {
      tokens.push(match[2]);
    } else {
      tokens.push(match[0]);
    }
  }

  const command = (tokens[0] || '').toLowerCase();
  const args = tokens.slice(1);
  return { command, args };
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'position',
    aliases: ['pos'],
    usage: 'position',
    description: 'Print current bot coordinates',
    execute: async (_args, runtime) => {
      const pos = runtime.movement.getPosition();
      return `Current position: ${formatCoordinates(pos)}`;
    },
  },
  {
    name: 'move',
    usage: 'move <x> <y> <z>',
    description: 'Move bot to coordinates using Pathfinder',
    execute: async (args, runtime) => {
      const [rawX, rawY, rawZ] = args;
      if (!rawX || !rawY || !rawZ) {
        throw new Error('Usage: move <x> <y> <z>');
      }
      const x = parseFloat(rawX);
      const y = parseFloat(rawY);
      const z = parseFloat(rawZ);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error('Coordinates must be valid numbers: move <x> <y> <z>');
      }

      const result = await runtime.movement.moveToPosition(x, y, z);
      return formatSuccess(result.message || 'Successfully moved');
    },
  },
  {
    name: 'fly',
    usage: 'fly <x> <y> <z>',
    description: 'Fly bot to coordinates (requires Creative mode)',
    execute: async (args, runtime) => {
      const [rawX, rawY, rawZ] = args;
      if (!rawX || !rawY || !rawZ) {
        throw new Error('Usage: fly <x> <y> <z>');
      }
      const x = parseFloat(rawX);
      const y = parseFloat(rawY);
      const z = parseFloat(rawZ);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error('Coordinates must be valid numbers: fly <x> <y> <z>');
      }

      const result = await runtime.movement.flyTo(x, y, z);
      return formatSuccess(result.message || 'Successfully flew');
    },
  },
  {
    name: 'place',
    usage: 'place <block> <x> <y> <z>',
    description: 'Place a block from inventory at coordinates',
    execute: async (args, runtime) => {
      const [blockName, rawX, rawY, rawZ] = args;
      if (!blockName || !rawX || !rawY || !rawZ) {
        throw new Error('Usage: place <block> <x> <y> <z>');
      }
      const x = parseFloat(rawX);
      const y = parseFloat(rawY);
      const z = parseFloat(rawZ);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error('Coordinates must be valid numbers: place <block> <x> <y> <z>');
      }

      const result = await runtime.blocks.placeBlock(blockName, x, y, z, 'down');
      return formatSuccess(result.message || `Placed ${blockName} at (${x}, ${y}, ${z})`);
    },
  },
  {
    name: 'dig',
    usage: 'dig <x> <y> <z>',
    description: 'Dig block at coordinates',
    execute: async (args, runtime) => {
      const [rawX, rawY, rawZ] = args;
      if (!rawX || !rawY || !rawZ) {
        throw new Error('Usage: dig <x> <y> <z>');
      }
      const x = parseFloat(rawX);
      const y = parseFloat(rawY);
      const z = parseFloat(rawZ);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error('Coordinates must be valid numbers: dig <x> <y> <z>');
      }

      const blockName = await runtime.blocks.digBlock(x, y, z);
      return formatSuccess(`Dug ${blockName} at (${x}, ${y}, ${z})`);
    },
  },
  {
    name: 'info',
    usage: 'info <x> <y> <z>',
    description: 'Get block information at coordinates',
    execute: async (args, runtime) => {
      const [rawX, rawY, rawZ] = args;
      if (!rawX || !rawY || !rawZ) {
        throw new Error('Usage: info <x> <y> <z>');
      }
      const x = parseFloat(rawX);
      const y = parseFloat(rawY);
      const z = parseFloat(rawZ);

      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(z)) {
        throw new Error('Coordinates must be valid numbers: info <x> <y> <z>');
      }

      const info = runtime.blocks.getBlockInfo(x, y, z);
      return formatBlock(info, { x, y, z });
    },
  },
  {
    name: 'find',
    usage: 'find <block> [maxDistance] [count]',
    description: 'Search for nearby blocks of a specific type',
    execute: async (args, runtime) => {
      const [blockType, rawDistance, rawCount] = args;
      if (!blockType) {
        throw new Error('Usage: find <block> [maxDistance] [count]');
      }
      const maxDistance = rawDistance ? parseInt(rawDistance, 10) : 16;
      const count = rawCount ? parseInt(rawCount, 10) : 1;

      if (Number.isNaN(maxDistance) || maxDistance <= 0) {
        throw new Error('maxDistance must be a positive number');
      }
      if (Number.isNaN(count) || count <= 0) {
        throw new Error('count must be a positive integer');
      }

      const blocksResult = runtime.blocks.findBlocks(blockType, maxDistance, count);
      return formatFoundBlocks(blocksResult.blocks, blockType, maxDistance);
    },
  },
  {
    name: 'inventory',
    aliases: ['inv'],
    usage: 'inventory',
    description: 'List inventory items and counts',
    execute: async (_args, runtime) => {
      const res = runtime.inventory.listInventory();
      return formatInventory(res.items);
    },
  },
  {
    name: 'equip',
    usage: 'equip <item> [destination]',
    description: 'Equip an item from inventory (destination: hand, head, torso, legs, feet, off-hand)',
    execute: async (args, runtime) => {
      const [item, destination = 'hand'] = args;
      if (!item) {
        throw new Error('Usage: equip <item> [destination]');
      }

      const res = await runtime.inventory.equipItem(item, destination);
      if (!res.success) {
        throw new Error(res.message);
      }
      return formatSuccess(res.message || 'Item equipped');
    },
  },
  {
    name: 'chat',
    usage: 'chat <message>',
    description: 'Send in-game chat message',
    execute: async (args, runtime) => {
      const message = args.join(' ');
      if (!message) {
        throw new Error('Usage: chat <message>');
      }
      runtime.chat.sendChat(message);
      return formatSuccess(`Sent chat: "${message}"`);
    },
  },
  {
    name: 'status',
    usage: 'status',
    description: 'Print bot and connection status',
    execute: async (_args, runtime) => {
      const status = runtime.getStatus();
      return formatStatus(status);
    },
  },
  {
    name: 'health',
    usage: 'health',
    description: 'Print internal runtime health check',
    execute: async (_args, runtime) => {
      const health = runtime.getHealth();
      return formatHealth(health);
    },
  },
  {
    name: 'gamemode',
    usage: 'gamemode',
    description: 'Detect current gamemode',
    execute: async (_args, runtime) => {
      const mode = runtime.world.detectGamemode();
      return formatInfo(`Current gamemode: ${mode}`);
    },
  },
  {
    name: 'help',
    usage: 'help',
    description: 'List available commands',
    execute: async () => {
      return formatHelp(COMMANDS);
    },
  },
  {
    name: 'exit',
    aliases: ['quit'],
    usage: 'exit',
    description: 'Disconnect bot and close Dev Shell',
    execute: async (_args, runtime) => {
      await runtime.disconnect();
      return 'Exiting dev shell. Goodbye!';
    },
  },
];

const commandMap = new Map<string, CommandDefinition>();

for (const cmd of COMMANDS) {
  commandMap.set(cmd.name.toLowerCase(), cmd);
  if (cmd.aliases) {
    for (const alias of cmd.aliases) {
      commandMap.set(alias.toLowerCase(), cmd);
    }
  }
}

export function getCommand(name: string): CommandDefinition | undefined {
  return commandMap.get(name.toLowerCase());
}

export function getAllCommands(): CommandDefinition[] {
  return [...COMMANDS];
}

/**
 * Executes a single command string against the Minecraft runtime.
 */
export async function executeCommand(
  line: string,
  runtime: MinecraftRuntime
): Promise<string> {
  const { command, args } = parseCommandLine(line);
  if (!command) return '';

  const cmdDef = getCommand(command);
  if (!cmdDef) {
    return formatError(`Unknown command: "${command}". Type "help" to see available commands.`);
  }

  try {
    return await cmdDef.execute(args, runtime);
  } catch (err) {
    return formatError(err);
  }
}
