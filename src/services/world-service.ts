import { BaseService } from './base-service.js';

export interface EntityInfo {
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  distance: number;
}

export class WorldService extends BaseService {
  detectGamemode(): string {
    return this.bot.game?.gameMode ?? 'survival';
  }

  findEntity(entityType?: string, maxDistance = 32): EntityInfo | null {
    const botPos = this.bot.entity.position;
    let closestEntity = null;
    let minDistance = maxDistance;

    for (const id in this.bot.entities) {
      const entity = this.bot.entities[id];
      if (!entity || entity === this.bot.entity) continue;

      if (entityType && entity.name !== entityType && entity.type !== entityType) {
        continue;
      }

      const dist = botPos.distanceTo(entity.position);
      if (dist <= minDistance) {
        minDistance = dist;
        closestEntity = entity;
      }
    }

    if (!closestEntity) return null;

    return {
      name: closestEntity.name || closestEntity.username || 'unknown',
      type: closestEntity.type || 'unknown',
      position: {
        x: Math.floor(closestEntity.position.x),
        y: Math.floor(closestEntity.position.y),
        z: Math.floor(closestEntity.position.z)
      },
      distance: Math.round(minDistance * 10) / 10
    };
  }
}
