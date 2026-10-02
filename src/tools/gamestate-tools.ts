import { ToolFactory } from '../tool-factory.js';
import { GameStateService } from '../services/game-state-service.js';
import type { BotOrGetter } from '../services/types.js';

export function registerGameStateTools(
  factory: ToolFactory,
  botOrService: BotOrGetter | GameStateService
): void {
  const gameStateService = botOrService instanceof GameStateService
    ? botOrService
    : new GameStateService(botOrService);

  factory.registerTool(
    "detect-gamemode",
    "Detect the gamemode on game",
    {},
    async () => {
      const result = gameStateService.detectGamemode();
      return factory.createResponse(result.message);
    }
  );
}
