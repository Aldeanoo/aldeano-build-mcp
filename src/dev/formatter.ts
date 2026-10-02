/**
 * Dev Shell Output Formatter
 * Human-friendly string and ANSI color formatting for Minecraft coordinates,
 * blocks, inventory items, status banners, tables, and errors.
 */

import type { RuntimeStatus, RuntimeHealth } from '../runtime/runtime.js';
import type { BlockInfoResult } from '../services/blocks-service.js';
import type { InventoryItem } from '../services/types.js';

let colorsEnabled = !process.env.NO_COLOR && (process.stdout.isTTY ?? true);

export function setColorsEnabled(enabled: boolean): void {
  colorsEnabled = enabled;
}

export function isColorsEnabled(): boolean {
  return colorsEnabled;
}

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

function wrap(code: string, text: string): string {
  if (!colorsEnabled) return text;
  return `${ESC}${code}m${text}${RESET}`;
}

export const colorize = {
  bold: (t: string) => wrap('1', t),
  dim: (t: string) => wrap('2', t),
  red: (t: string) => wrap('31', t),
  green: (t: string) => wrap('32', t),
  yellow: (t: string) => wrap('33', t),
  blue: (t: string) => wrap('34', t),
  magenta: (t: string) => wrap('35', t),
  cyan: (t: string) => wrap('36', t),
  white: (t: string) => wrap('37', t),
  gray: (t: string) => wrap('90', t),
};

export function formatSuccess(message: string): string {
  return `${colorize.green('✔')} ${colorize.bold(message)}`;
}

export function formatError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  return `${colorize.red('✖')} ${colorize.bold(colorize.red('Error:'))} ${msg}`;
}

export function formatWarning(message: string): string {
  return `${colorize.yellow('⚠')} ${colorize.yellow(message)}`;
}

export function formatInfo(message: string): string {
  return `${colorize.cyan('ℹ')} ${message}`;
}

/**
 * Welcome banner displayed when the Dev Shell starts.
 */
export function formatBanner(info: {
  host: string;
  port: number;
  username: string;
  connected?: boolean;
}): string {
  const connStatus = info.connected ?? true ? 'connected' : 'disconnected';
  const connText = info.connected ?? true ? colorize.green(connStatus) : colorize.red(connStatus);

  return [
    colorize.bold(colorize.cyan('Aldeano Build MCP Dev Shell')),
    `Minecraft: ${connText}`,
    `Host: ${info.host}`,
    `Port: ${info.port}`,
    `Bot: ${colorize.bold(info.username)}`,
  ].join('\n');
}

/**
 * Format 3D position coordinates.
 */
export function formatCoordinates(pos: { x: number; y: number; z: number }): string {
  const x = colorize.bold(pos.x.toString());
  const y = colorize.bold(pos.y.toString());
  const z = colorize.bold(pos.z.toString());
  return `(X: ${x}, Y: ${y}, Z: ${z})`;
}

/**
 * Format block inspection info.
 */
export function formatBlock(
  info: BlockInfoResult | null,
  coords?: { x: number; y: number; z: number }
): string {
  if (!info || !info.name || info.name === 'air') {
    const loc = coords ? ` at ${formatCoordinates(coords)}` : '';
    return colorize.gray(`No block found (air)${loc}`);
  }

  const name = colorize.bold(colorize.yellow(info.name));
  const type = info.type !== undefined ? colorize.gray(`(ID: ${info.type})`) : '';
  const pos = info.position ? formatCoordinates(info.position) : (coords ? formatCoordinates(coords) : '');

  return `Block: ${name} ${type} at ${pos}`;
}

/**
 * Format list of blocks found nearby.
 */
export function formatFoundBlocks(
  blocks: Array<{ x: number; y: number; z: number }>,
  blockType: string,
  maxDistance = 16
): string {
  if (blocks.length === 0) {
    return colorize.gray(`No ${colorize.yellow(blockType)} found within ${maxDistance} blocks.`);
  }

  const header = colorize.bold(
    `Found ${colorize.green(blocks.length.toString())} ${colorize.yellow(blockType)} block(s) within ${maxDistance} blocks:`
  );

  const lines = blocks.map((b, i) => {
    const idx = colorize.gray(`${i + 1}.`);
    return `  ${idx} ${formatCoordinates(b)}`;
  });

  return [header, ...lines].join('\n');
}

/**
 * Format inventory items in a clean table.
 */
export function formatInventory(items: InventoryItem[]): string {
  if (!items || items.length === 0) {
    return colorize.gray('Inventory is empty.');
  }

  const headers = ['Slot', 'Item Name', 'Count'];
  const rows = items.map((item) => [
    item.slot !== undefined ? item.slot.toString() : '-',
    item.name,
    `x${item.count}`,
  ]);

  const table = formatTable(headers, rows);
  const totalCount = items.reduce((acc, it) => acc + it.count, 0);
  const summary = colorize.dim(`Total: ${items.length} unique slot(s), ${totalCount} item(s)`);

  return `${table}\n${summary}`;
}

/**
 * Format bot and connection status.
 */
export function formatStatus(status: RuntimeStatus): string {
  const connStr = status.connected
    ? colorize.green('connected')
    : colorize.red(status.state || 'disconnected');

  const lines: string[] = [
    colorize.bold(colorize.cyan('=== Minecraft Bot & Connection Status ===')),
    `  Connection:  ${connStr}`,
    `  Server:      ${status.host}:${status.port}`,
    `  Username:    ${colorize.bold(status.username)}`,
  ];

  if (status.botSpawned) {
    const hpStr = status.health !== null
      ? `${status.health > 5 ? colorize.green(status.health.toString()) : colorize.red(status.health.toString())}/20`
      : 'N/A';
    const foodStr = status.food !== null ? `${status.food}/20` : 'N/A';
    const posStr = status.position ? formatCoordinates(status.position) : 'unknown';
    const aliveStr = status.isAlive ? colorize.green('yes') : colorize.red('no');
    const pingStr = status.ping !== null ? `${status.ping}ms` : 'unknown';

    lines.push(
      `  Gamemode:    ${colorize.yellow(status.gamemode)}`,
      `  Position:    ${posStr}`,
      `  Health:      ${hpStr}  |  Food: ${foodStr}`,
      `  Alive:       ${aliveStr}  |  Ping: ${pingStr}`,
      `  Dimension:   ${status.dimension}  |  Difficulty: ${status.difficulty}`,
      `  Inventory:   ${status.inventoryCount} item stack(s)`
    );
  } else {
    lines.push(colorize.gray('  Bot:         Not spawned yet'));
  }

  return lines.join('\n');
}

/**
 * Format internal runtime health check.
 */
export function formatHealth(health: RuntimeHealth): string {
  const statusColor =
    health.status === 'healthy'
      ? colorize.bold(colorize.green('[ OK ] HEALTHY'))
      : health.status === 'degraded'
      ? colorize.bold(colorize.yellow('[ WARN ] DEGRADED'))
      : colorize.bold(colorize.red('[ FAIL ] UNHEALTHY'));

  const memStr = `Heap: ${health.memory.heapUsedMB} MB / ${health.memory.heapTotalMB} MB  |  RSS: ${health.memory.rssMB} MB`;
  const botState = health.botSpawned
    ? `Spawned (Alive: ${health.bot.isAlive ? 'yes' : 'no'}, HP: ${health.bot.health ?? 'N/A'}, Food: ${health.bot.food ?? 'N/A'}, Ping: ${health.bot.ping !== null ? `${health.bot.ping}ms` : 'N/A'})`
    : 'Not spawned';

  return [
    colorize.bold(colorize.cyan('=== Aldeano Build MCP - Runtime Health Check ===')),
    `  Health:      ${statusColor}`,
    `  Summary:     ${health.summary}`,
    `  Connection:  ${health.connected ? colorize.green('connected') : colorize.red(health.state)} (${health.server.host}:${health.server.port})`,
    `  Bot State:   ${botState}`,
    `  Uptime:      ${health.uptimeSeconds}s`,
    `  Memory:      ${memStr}`,
    `  MC Version:  ${health.server.version}`,
  ].join('\n');
}

/**
 * Format a generic table with clean unicode box borders.
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, r) => Math.max(max, (r[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const pad = (str: string, len: number) => str + ' '.repeat(Math.max(0, len - str.length));

  const topBorder = '┌─' + colWidths.map((w) => '─'.repeat(w)).join('─┬─') + '─┐';
  const midBorder = '├─' + colWidths.map((w) => '─'.repeat(w)).join('─┼─') + '─┤';
  const botBorder = '└─' + colWidths.map((w) => '─'.repeat(w)).join('─┴─') + '─┘';

  const headerRow = '│ ' + headers.map((h, i) => colorize.bold(pad(h, colWidths[i]))).join(' │ ') + ' │';

  const dataRows = rows.map((r) => {
    return '│ ' + r.map((c, i) => pad(c, colWidths[i])).join(' │ ') + ' │';
  });

  return [topBorder, headerRow, midBorder, ...dataRows, botBorder].join('\n');
}

/**
 * Format help overview for dev shell commands.
 */
export function formatHelp(
  commands: Array<{
    name: string;
    aliases?: string[];
    usage: string;
    description: string;
  }>
): string {
  const lines: string[] = [
    colorize.bold(colorize.cyan('Aldeano Build MCP - Dev Shell Commands:')),
    '',
  ];

  const maxUsageLen = commands.reduce((max, c) => Math.max(max, c.usage.length), 0) + 2;

  for (const cmd of commands) {
    const aliasStr = cmd.aliases && cmd.aliases.length > 0 ? colorize.gray(` (${cmd.aliases.join(', ')})`) : '';
    const usagePadded = cmd.usage + ' '.repeat(Math.max(0, maxUsageLen - cmd.usage.length));
    lines.push(`  ${colorize.yellow(usagePadded)}${cmd.description}${aliasStr}`);
  }

  lines.push('');
  lines.push(colorize.dim('Type command and press Enter. Type "exit" or "quit" to close REPL.'));
  return lines.join('\n');
}
