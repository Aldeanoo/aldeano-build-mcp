export interface RegisteredToolMetadata {
  name: string;
  risk: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
  requiresMinecraft: boolean;
  requiresCreative: boolean;
  destructive: boolean;
}

const DESTRUCTIVE = new Set(['dig-block', 'clear-region', 'replace-blocks', 'remove-location', 'text.write-book']);
const HIGH_COST = new Set([
  'build-line', 'build-wall', 'build-floor', 'build-column', 'build-box', 'build-hollow-box', 'build-cylinder', 'build-sphere', 'build-roof',
  'fill-region', 'clear-region', 'replace-blocks', 'clone-region', 'build.blueprint', 'repair-build', 'world.get-region', 'world.scan-region', 'world.get-heightmap', 'world.screenshot'
]);
const MEDIUM_COST = new Set(['move-to-position', 'fly-to', 'movement.teleport', 'navigate-to', 'go-to-location', 'place-block', 'dig-block', 'craft-item', 'smelt-item', 'verify-build']);
const MUTATING = new Set([
  'text.place', 'text.write-book', 'text.give-book', 'movement.teleport-player',
  'place-block', 'dig-block', 'craft-item', 'smelt-item', 'equip-item', 'send-chat', 'fly-to', 'stop-flying', 'move-to-position', 'navigate-to', 'go-to-location',
  'build-line', 'build-wall', 'build-floor', 'build-column', 'build-box', 'build-hollow-box', 'build-cylinder', 'build-sphere', 'build-roof',
  'fill-region', 'clear-region', 'replace-blocks', 'clone-region', 'build.blueprint', 'repair-build', 'build.cancel', 'build.pause', 'build.resume',
  'remember-location', 'remove-location'
]);

export function getToolMetadata(name: string): RegisteredToolMetadata {
  const destructive = DESTRUCTIVE.has(name);
  return {
    name,
    risk: destructive ? 'high' : MUTATING.has(name) || ['text.place','movement.teleport','build.roof','build.blueprint.v2','build.recover','verify-build'].includes(name) ? 'medium' : 'low',
    cost: HIGH_COST.has(name) || ['text.place','build.roof','build.blueprint.v2','build.recover'].includes(name) ? 'high' : MEDIUM_COST.has(name) ? 'medium' : 'low',
    requiresMinecraft: true,
    requiresCreative: ['text.place','text.write-book','text.give-book','movement.teleport-player','movement.teleport','fly-to'].includes(name),
    destructive
  };
}
