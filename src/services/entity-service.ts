import type mineflayer from 'mineflayer';
import { resolveBot } from './service-utils.js';
import { normalizeWorldText } from '../world/untrusted-content.js';
import type {
  BotOrGetter,
  EntityResult
} from './types.js';

type Entity = ReturnType<mineflayer.Bot['nearestEntity']>;

export class EntityService {
  constructor(private botOrGetter: BotOrGetter) {}

  protected getBot(): mineflayer.Bot {
    return resolveBot(this.botOrGetter);
  }

  findEntity(type = '', maxDistance = 16): EntityResult {
    const bot = this.getBot();

    const entityFilter = (entity: NonNullable<Entity>) => {
      if (!type) return true;
      if (type === 'player') return entity.type === 'player';
      if (type === 'mob') return entity.type === 'mob';
      return Boolean(entity.name && entity.name.toLowerCase().includes(type.toLowerCase()));
    };

    const entity = bot.nearestEntity(entityFilter);

    if (!entity || bot.entity.position.distanceTo(entity.position) > maxDistance) {
      return {
        success: false,
        message: `No ${type || 'entity'} found within ${maxDistance} blocks`
      };
    }

    const entityName = normalizeWorldText(entity.name || (entity as { username?: string }).username || entity.type, 128);
    const position = {
      x: Math.floor(entity.position.x),
      y: Math.floor(entity.position.y),
      z: Math.floor(entity.position.z)
    };

    return {
      success: true,
      entity: {
        name: entityName,
        type: entity.type,
        position
      },
      message: `Found ${entityName} at position (${position.x}, ${position.y}, ${position.z})`
    };
  }
}
