# Aldeano Build MCP

[![CI](https://github.com/Aldeano-Build/aldeano-build-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Aldeano-Build/aldeano-build-mcp/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.10.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Spec](https://img.shields.io/badge/MCP-1.27.1-purple.svg)](https://modelcontextprotocol.io/)

An extensible, provider-neutral **Model Context Protocol (MCP)** server and high-level automation framework that enables AI agents to perceive, navigate, interact with, and build inside Minecraft.

---

## Origin & Attribution

> [!NOTE]
> **Aldeano Build MCP is based on [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server).**
> The project has been extended and redesigned for high-level Minecraft automation and AI agent workflows, introducing a decoupled Services layer, dual-mode execution (MCP Server + Dev Shell), diagnostic tooling, typed error domains, and robust unit & integration test coverage.

---

## Project Philosophy

> **"LLM ≠ Minecraft implementation"**

Large Language Models (LLMs) excel at spatial reasoning, planning, goal decomposition, and conversational reasoning. However, game execution requires rock-solid pathfinding, voxel physics, block collision detection, inventory graph logic, and protocol synchronization.

Aldeano Build MCP adheres to a strict **provider-neutral design**:
- Works identically with **Claude** (`ClaudeBot`), **Gemini** (`GeminiBot`), **MiniMax** (`MiniMaxBot`), **ChatGPT** (`ChatGPTBot`), or local dev sessions (`TestBot`, `MCPBot`).
- Separates MCP protocol adapters from the **Services Layer**, meaning all capabilities can be invoked by LLMs via stdio JSON-RPC, executed in an interactive REPL terminal, or scripted programmatically in TypeScript.

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Development & Dev Shell](#development--dev-shell)
- [Minecraft Setup](#minecraft-setup)
- [MCP Setup](#mcp-setup)
- [Command Line Options](#command-line-options)
- [Available Tools](#available-tools)
- [Tool Namespacing Convention](#tool-namespacing-convention)
- [Architecture](#architecture)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

---

## Overview

Aldeano Build MCP provides:
- **Perception**: Spatial coordinate tracking, surrounding block inspection, nearby entity detection, and player chat monitoring.
- **Locomotion**: Intelligent 3D pathfinding with obstacle avoidance, flight capabilities (creative mode), direction pulses, and discrete jumping.
- **Manipulation**: Block placement with collision detection, voxel excavation, block type searches, inventory equipping, and crafting.
- **Dual Execution**: Seamless switching between **MCP Server Mode** (for AI hosts) and **Dev Shell Mode** (interactive REPL for developers).
- **Diagnostics**: Built-in environment and port health checker (`npm run doctor`).

---

## Quick Start

Launch a local server and have a bot running in Minecraft in just **4 commands**:

```bash
git clone https://github.com/Aldeano-Build/aldeano-build-mcp.git && cd aldeano-build-mcp
npm install
npm run mc:setup
npm run mc:start && npm run dev:shell -- --username TestBot
```

*(Note: Run `npm run mc:start` and `npm run dev:shell` in separate terminal windows, or run `npm run dev:all` to start both concurrently).*

---

## Development & Dev Shell

Aldeano Build MCP includes an interactive developer shell that lets you inspect and command the bot directly without requiring an LLM client:

```bash
# Run the interactive REPL shell
npm run dev:shell -- --username TestBot

# Run system health diagnostics
npm run doctor

# Reset local test world data
npm run mc:reset
```

### Dev Shell Commands:
- `pos`: Print the bot's current 3D coordinates.
- `move <x> <y> <z>`: Pathfind to specified coordinates.
- `look <x> <y> <z>`: Orient bot head towards a location.
- `jump`: Trigger a jump.
- `block <x> <y> <z>`: Inspect the block at coordinates.
- `dig <x> <y> <z>`: Break block at coordinates.
- `chat <message>`: Send a message in-game.
- `inv`: List current inventory items and slots.
- `quit` / `exit`: Disconnect the bot.

---

## Minecraft Setup

### Option 1: Automatic Local Server (Recommended for Testing)
Use the included automated setup script (requires Java 17 or 21):
```bash
# Downloads official server jar, accepts EULA, and configures offline localhost server
npm run mc:setup

# Start the server (runs on 127.0.0.1:25565)
npm run mc:start
```

### Option 2: Singleplayer LAN Game
1. Launch Minecraft (Java Edition 1.20 - 1.21+).
2. Create or load a world (Creative mode with cheats enabled is recommended).
3. Press `ESC` -> **Open to LAN**.
4. Set **Allow Cheats: ON**, port to `25565`, and click **Start LAN World**.

---

## MCP Setup

To connect Aldeano Build MCP to an AI host (like Claude Desktop, Cursor, Continue, or LibreChat):

### Claude Desktop Configuration
Open your Claude Desktop config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add the server entry:

```json
{
  "mcpServers": {
    "minecraft": {
      "command": "npx",
      "args": [
        "-y",
        "aldeano-build-mcp",
        "--host",
        "127.0.0.1",
        "--port",
        "25565",
        "--username",
        "ClaudeBot"
      ]
    }
  }
}
```

Restart Claude Desktop completely from your system tray/dock. Once started, Claude will display available Minecraft tools!

---

## Command Line Options

Aldeano Build MCP supports flexible CLI flags and environment variables. Precedence is:
`CLI Arguments > Environment Variables > Defaults`

| CLI Option | Env Variable | Default | Description |
|------------|--------------|---------|-------------|
| `--host <string>` | `MC_HOST` / `MINECRAFT_HOST` | `127.0.0.1` | Minecraft server hostname or IP address |
| `--port <number>` | `MC_PORT` / `MINECRAFT_PORT` | `25565` | Minecraft server port |
| `--username <string>` | `MC_USERNAME` / `MINECRAFT_USERNAME` | `LLMBot` | In-game player username for the bot |
| `--version <string>` | `MC_VERSION` / `MINECRAFT_VERSION` | `1.20.4` | Minecraft game/protocol version |
| `--auth <string>` | `MC_AUTH` / `MINECRAFT_AUTH` | `offline` | Authentication mode (`offline` or `microsoft`) |
| `--connect-timeout <ms>` | `MC_CONNECT_TIMEOUT` | `30000` | Connection handshake timeout in milliseconds |
| `--reconnect / --no-reconnect` | `MC_RECONNECT` | `true` | Automatically reconnect upon server disconnection |
| `--log-level <string>` | `LOG_LEVEL` / `MC_LOG_LEVEL` | `info` | Log verbosity (`error`, `warn`, `info`, `debug`, `trace`) |

---

## Available Tools

Once connected, your AI agent has access to these core tools:

### Movement & Locomotion
- `get-position`: Get the current `(x, y, z)` position of the bot.
- `move-to-position`: Pathfind to target coordinates with optional range and timeout.
- `look-at`: Make the bot face specific 3D coordinates.
- `jump`: Trigger a jump action.
- `move-in-direction`: Move forward, backward, left, or right for a duration in milliseconds.

### Flight (Creative Mode)
- `fly-to`: Fly directly through 3D space to destination coordinates.

### Voxel & World Manipulation
- `get-block-info`: Inspect block name, ID, and metadata at given coordinates.
- `find-blocks`: Locate the nearest blocks of a specific type (e.g. `diamond_ore`, `oak_log`).
- `place-block`: Place a block against a target face with self-placement collision prevention.
- `dig-block`: Break/mine a target block with automatic pathfinding into range.

### Inventory & Items
- `list-inventory`: List all items, quantities, and inventory slots.
- `equip-item`: Equip an item from inventory to the bot's hand or armor slot.

### Crafting & Smelting
- `can-craft`: Check if required ingredients and recipes are available.
- `get-recipe`: Retrieve ingredient details for a craftable item.
- `list-recipes`: List all recipes known to the bot.
- `craft-item`: Automatically craft an item using inventory resources.
- `smelt-item`: Smelt ores or food using a nearby furnace.

### Communication & Perception
- `send-chat`: Send a chat message into the game.
- `read-chat`: Read recent messages sent by other players in the world.
- `find-entity`: Locate the nearest mob, animal, or player by entity type.
- `detect-gamemode`: Detect current game mode (`survival`, `creative`, `adventure`, `spectator`).

---

## Tool Namespacing Convention

To support the rapid expansion of high-level construction capabilities, future tools are organized under clear functional namespaces:

- **`movement.*`**: Locomotion, waypoints, pathfinding controls (`movement.moveTo`, `movement.jump`).
- **`blocks.*`**: Block inspection, raycasts, single-voxel actions (`blocks.info`, `blocks.place`).
- **`inventory.*`**: Equipment, hotbar selection, storage queries (`inventory.list`, `inventory.equip`).
- **`world.*`**: Biome info, time of day, weather, entity tracking (`world.entities`, `world.scan`).
- **`build.*`**: High-level structural construction, blueprint layout, schematics (`build.wall`, `build.schematic`).
- **`system.*`**: Health, runtime diagnostics, reconnect status (`system.status`, `system.reconnect`).

---

## Architecture

Aldeano Build MCP is built on a clean, layered architecture:

```
┌────────────────────────────────────────────────────────┐
│               AI Host / Dev Shell / Tests              │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│      Transport Layer (MCP JSON-RPC / CLI REPL)         │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│       Services Layer (Movement, Blocks, Inventory...)  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│      Runtime & Session Layer (Mineflayer + Pathfinder)  │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                   Minecraft Server                     │
└────────────────────────────────────────────────────────┘
```

For complete architectural details, lifecycle diagrams, and security models, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Testing

We enforce rigorous test coverage separated into unit and integration suites:

```bash
# Run unit tests (fast, mock-based, offline)
npm test

# Run integration tests (offline-safe)
npm run test:integration

# Run live Minecraft smoke test (connects, moves, places, destroys, disconnects)
npm run test:minecraft

# Run linting
npm run lint

# Build TypeScript to dist/
npm run build
```

---

## Roadmap

- [x] Decoupled domain Services layer.
- [x] Dual-mode runtime (MCP Server + Dev Shell).
- [x] Automated local server setup and world reset scripts.
- [x] Typed error domain hierarchy.
- [x] 200+ unit and integration test suite with CI workflow.
- [ ] Schematic and blueprint layout engine (`build.*`).
- [ ] Multi-bot worker coordination.
- [ ] Visual spatial map rasterization for multi-modal VLM agents.

---

## Contributing

We welcome contributions from the community! Please read **[CONTRIBUTING.md](CONTRIBUTING.md)** for our branching strategy (`develop`, `feature/*`, `fix/*`), PR guidelines, and coding standards.

---

## Credits

- **[yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server)**: The original foundation for Minecraft MCP server interaction.
- **[Mineflayer](https://github.com/PrismarineJS/mineflayer)**: Powerful JavaScript API for Minecraft bots.
- **[mineflayer-pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)**: 3D pathfinding engine for Mineflayer.
- **[Model Context Protocol](https://modelcontextprotocol.io/)**: The open standard for connecting AI models to tools and data sources.

---

## License

This project is licensed under the [MIT License](LICENSE).
