import test from 'ava';
import { buildBox, buildHollowBox } from '../../src/build/primitives/box.js';
import { buildSphere } from '../../src/build/primitives/sphere.js';
import { buildCylinder } from '../../src/build/primitives/cylinder.js';
import { buildWall } from '../../src/build/primitives/wall.js';
import { buildRoofDetailed } from '../../src/build/primitives/roof.js';
import { BuildLimitError } from '../../src/build/build-types.js';
import { BuildService } from '../../src/build/build-service.js';
import { registerBuildTools } from '../../src/tools/build-tools.js';
import type { ToolFactory } from '../../src/tool-factory.js';

const origin = { x: 0, y: 64, z: 0 };
const limits = { maxBlocks: 10, maxQueue: 10, maxDimension: 256, maxPreflightBlocks: 1_000_000 };

test('solid and curved generators respect output and queue limits', (t) => {
  t.throws(() => buildSphere(origin, 20, 'stone', false, limits), { instanceOf: BuildLimitError });
  t.throws(() => buildCylinder(origin, 2, 2, 'stone', false, limits), { instanceOf: BuildLimitError });
  t.throws(() => buildWall(origin, { ...origin, x: 5 }, 2, 'stone', limits), { instanceOf: BuildLimitError });
  t.throws(() => buildBox(origin, { x: 4, y: 68, z: 4 }, 'stone', false, limits), { instanceOf: BuildLimitError });
  t.throws(() => buildSphere(origin, 1, 'stone', false, { ...limits, maxBlocks: 100, maxQueue: 1 }), { instanceOf: BuildLimitError });
});

test('hollow generation uses its exact shell count instead of its solid volume', (t) => {
  const end = { x: 4, y: 68, z: 4 };
  const configured = { ...limits, maxBlocks: 98, maxQueue: 98 };
  t.is(buildHollowBox(origin, end, 'stone', configured).length, 98);
  t.throws(() => buildBox(origin, end, 'stone', false, configured), { instanceOf: BuildLimitError });
  t.deepEqual(buildSphere(origin, 2, 'stone', true, { ...limits, maxBlocks: 100, maxQueue: 100 }), buildSphere(origin, 2, 'stone', true));
});

test('roof checks overhang, thickness and output against configured budgets', (t) => {
  t.throws(() => buildRoofDetailed(origin, { ...origin, x: 2, z: 2 }, 'stone', { overhang: 1 }, limits), { instanceOf: BuildLimitError });
  t.throws(() => buildRoofDetailed(origin, { ...origin, x: 2, z: 2 }, 'stone', { thickness: 2 }, limits), { instanceOf: BuildLimitError });
});

test('valid custom dimensions are supported and candidate work remains bounded', (t) => {
  const configured = { maxBlocks: 300, maxQueue: 300, maxDimension: 300, maxPreflightBlocks: 300 };
  t.is(buildBox(origin, { ...origin, x: 299 }, 'stone', false, configured).length, 300);
  t.throws(() => buildBox(origin, { ...origin, x: 299 }, 'stone', false, { ...configured, maxPreflightBlocks: 299 }), { instanceOf: BuildLimitError });
});

test('every MCP primitive rejects oversized input before execution or world access', async (t) => {
  let executions = 0, accesses = 0;
  const service = new BuildService(() => { accesses++; throw new Error('Unexpected bot access'); }, { ...limits, checkpointDirectory: false });
  const original = service.executePlacements.bind(service);
  service.executePlacements = (...args) => { executions++; return original(...args); };
  const handlers = new Map<string, (args: object) => Promise<unknown>>();
  const factory = {
    registerTool: (name: string, _description: string, _schema: unknown, handler: (args: object) => Promise<unknown>) => handlers.set(name, handler),
  } as unknown as ToolFactory;
  registerBuildTools(factory, service);
  const cases: Array<[string, object]> = [
    ['build-line', { from: [0, 64, 0], to: [20, 64, 0], block: 'stone' }],
    ['build-wall', { from: [0, 64, 0], to: [5, 64, 0], height: 2, block: 'stone' }],
    ['build-floor', { from: [0, 64, 0], to: [3, 64, 3], block: 'stone' }],
    ['build-column', { origin: [0, 64, 0], height: 11, block: 'stone' }],
    ['build-box', { from: [0, 64, 0], to: [2, 66, 2], block: 'stone' }],
    ['build-hollow-box', { from: [0, 64, 0], to: [2, 66, 2], block: 'stone' }],
    ['build-sphere', { center: [0, 64, 0], radius: 20, block: 'stone' }],
    ['build-cylinder', { center: [0, 64, 0], radius: 2, height: 2, block: 'stone' }],
    ['build-roof', { from: [0, 64, 0], to: [3, 64, 3], block: 'stone' }],
    ['build.roof', { from: [0, 64, 0], to: [3, 64, 3], block: 'stone' }],
  ];
  for (const [name, args] of cases) await t.throwsAsync(handlers.get(name)!(args), { instanceOf: BuildLimitError });
  t.is(executions, 0);
  t.is(accesses, 0);
});
