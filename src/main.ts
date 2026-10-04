#!/usr/bin/env node
// Modified for Aldeano Build MCP; derived from yuniko-software/minecraft-mcp-server. See LICENSE and docs/attribution.md.
// SPDX-License-Identifier: Apache-2.0

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { setupStdioFiltering } from './stdio-filter.js';
import { log } from './logger.js';
import { parseConfig } from './config.js';
import { BotConnection } from './bot-connection.js';
import { ToolFactory } from './tool-factory.js';
import { MessageStore } from './message-store.js';
import { registerPositionTools } from './tools/position-tools.js';
import { registerInventoryTools } from './tools/inventory-tools.js';
import { registerBlockTools } from './tools/block-tools.js';
import { registerEntityTools } from './tools/entity-tools.js';
import { registerChatTools } from './tools/chat-tools.js';
import { registerFlightTools } from './tools/flight-tools.js';
import { registerGameStateTools } from './tools/gamestate-tools.js';
import { registerCraftingTools } from './tools/crafting-tools.js';
import { registerFurnaceTools } from './tools/furnace-tools.js';
import { registerBuildTools } from './tools/build-tools.js';
import { registerWorldTools } from './tools/world-tools.js';
import { registerLocationTools } from './tools/location-tools.js';
import { createServices } from './services/index.js';
import { BuildService } from './build/build-service.js';
import { WorldApiService } from './world/world-service.js';
import { LocationMemory } from './world/locations/location-memory.js';
import { NavigationService } from './world/navigation-service.js';
import { LetteringService } from './services/lettering/lettering-service.js';
import { registerLetteringTools } from './tools/lettering-tools.js';

setupStdioFiltering();

process.on('unhandledRejection', (reason) => {
  log('error', `Unhandled rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
  log('error', `Uncaught exception: ${error}`);
});

async function main() {
  const config = parseConfig();
  const messageStore = new MessageStore();

  const connection = new BotConnection(
    config,
    {
      onLog: log,
      onChatMessage: (username, message) => messageStore.addMessage(username, message)
    }
  );

  connection.connect();

  const server = new McpServer({
    name: "minecraft-mcp-server",
    version: "2.0.4"
  });

  const factory = new ToolFactory(server, connection);
  const getBot = () => connection.getBot()!;
  const services = createServices(getBot, messageStore);
  const buildService = new BuildService(getBot);
  const worldApi = new WorldApiService(getBot, buildService.config.maxScanBlocks);
  const locations = new LocationMemory();
  const navigation = new NavigationService(getBot);

  registerPositionTools(factory, services.movement);
  registerInventoryTools(factory, services.inventory);
  registerBlockTools(factory, services.block);
  registerEntityTools(factory, services.entity);
  registerChatTools(factory, services.chat);
  registerFlightTools(factory, services.movement);
  registerGameStateTools(factory, services.gameState);
  registerCraftingTools(factory, services.crafting);
  registerFurnaceTools(factory, services.furnace);
  registerBuildTools(factory, buildService);
  registerLetteringTools(factory, new LetteringService(getBot, buildService));
  registerWorldTools(factory, worldApi);
  registerLocationTools(factory, locations, navigation);

  process.stdin.on('end', () => {
    connection.cleanup();
    log('info', 'MCP Client has disconnected. Shutting down...');
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  log('error', `Fatal error in main(): ${error}`);
  process.exit(1);
});
