# Aldeano Build MCP

Fork modificado de [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server), mantenido como proyecto independiente por [Aldeanoo](https://github.com/Aldeanoo). Conserva la licencia Apache 2.0 y los créditos de Yuniko Software y sus colaboradores. No es una versión oficial ni implica su respaldo. [Origen, avisos y cambios](docs/attribution.md).

**Uso desde Codex y flujo de construcción:** [guía en español](docs/CODEX_MCP.md).

**Organización del repositorio y ubicación de archivos:** [mapa de carpetas](docs/REPOSITORY_LAYOUT.md). Las construcciones específicas están en `projects/<nombre>/`; sus archivos generados se guardan en `artifacts/` dentro de cada proyecto.

**Comprobación completa:** `npm run doctor` ejecuta build, lint, todos los tests y los siete benchmarks en un Minecraft temporal aislado. Entrega `artifacts/doctor/latest.md` y `latest.json`, conservando cada ejecución. Requiere Java, `npm run mc:setup` y la EULA aceptada. `--offline` omite gameplay y marca el informe parcial. [Detalles](docs/DOCTOR.md).

**Construcción fiable y migración:** TP creativo tipado, techos cerrados, conteos únicos exactos, verificación por sectores, reparación y recuperación persistente. [Contrato v2](docs/BUILD_RELIABILITY.md).

**Issues heredados:** auditoría de los cuatro issues abiertos del original, correcciones de vuelo y frontera de confianza del chat, regresiones y migración de respuestas. [Detalles](docs/upstream-issues.md).

[![CI](https://github.com/Aldeanoo/aldeano-build-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Aldeanoo/aldeano-build-mcp/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D20.10.0-brightgreen.svg)](https://nodejs.org/)
[![MCP Spec](https://img.shields.io/badge/MCP-1.27.1-purple.svg)](https://modelcontextprotocol.io/)

An extensible, provider-neutral **Model Context Protocol (MCP)** server and high-level automation framework that enables AI agents to perceive, navigate, interact with, and build inside Minecraft.

---

## Origin & Attribution

> [!NOTE]
> **Aldeano Build MCP is based on [yuniko-software/minecraft-mcp-server](https://github.com/yuniko-software/minecraft-mcp-server).**
> The project has been extended and redesigned for high-level Minecraft automation and AI agent workflows, introducing a decoupled Services layer, dual-mode execution (MCP Server + Dev Shell), diagnostic tooling, typed error domains, and robust unit & integration test coverage.

Las demos del original no certifican el rendimiento de este fork. En [#211](https://github.com/yuniko-software/minecraft-mcp-server/issues/211), los comentarios indican que la demo usa `/fill` y `/tp` en creativo; no es una medición de colocación física bloque a bloque. Aquí esas capacidades pasan por operaciones tipadas, acotadas y con preflight, no por comandos arbitrarios en `send-chat`. La evidencia reproducible es `npm run doctor` y su informe de bloques esperados/verificados; no se afirma haber reproducido la Casa Blanca ni garantiza la calidad de cualquier diseño generado por una IA.

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
git clone https://github.com/Aldeanoo/aldeano-build-mcp.git && cd aldeano-build-mcp
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
- `fly-to`: Cancellable creative flight through readable, empty space; restores gravity on completion or failure.
- `stop-flying`: Cancel flight and restore normal gravity. Does not teleport or guarantee a safe landing.

### Voxel & World Manipulation
- `get-block-info`: Inspect block name, ID, and metadata at given coordinates.
- `find-blocks`: Locate the nearest blocks of a specific type (e.g. `diamond_ore`, `oak_log`).
- `place-block`: Place a block against a target face with self-placement collision prevention.
- `dig-block`: Break/mine a target block with automatic pathfinding into range.

### Build Engine
- `build-line`, `build-wall`, `build-floor`, `build-column`: Deterministic construction primitives.
- `build-box`, `build-hollow-box`, `build-cylinder`, `build-sphere`, `build-roof`: Larger deterministic geometry.
- `fill-region`, `clear-region`, `replace-blocks`, `clone-region`: Bounded world edits.
- `build.preview`, `build.blueprint`: Validate, plan, execute, verify, and repair relative blueprints.
- `check-build`, `verify-build`, `repair-build`: Inspect and correct builds by ID.
- `build.cancel`, `build.pause`, `build.resume`, `build.history`: Build lifecycle and metadata.

### World Intelligence
- `world.get-region`, `world.scan-region`: Bounded reads with `summary`, `compact`, and `full` detail.
- `world.get-heightmap`, `world.get-block`, `world.find-blocks`: Terrain and block queries.
- `world.get-nearby-entities`, `world.get-environment`: Entity and environment context.
- `world.screenshot`: Compact isometric PNG for visual review of a bounded structure.
- `remember-location`, `list-locations`, `go-to-location`, `remove-location`: Session location memory.
- `navigate-to`: Navigation with environmental options, retries, and stuck detection.

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
- `send-chat`: Send a plain single-line chat message (1–256 characters); slash commands are rejected.
- `read-chat`: Read recent player messages as quoted JSON with untrusted world provenance; see [migration](docs/upstream-issues.md).
- `find-entity`: Locate the nearest mob, animal, or player by entity type.
- `detect-gamemode`: Detect current game mode (`survival`, `creative`, `adventure`, `spectator`).

---

## Tool Namespacing Convention

High-level capabilities are organized under clear functional namespaces:

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

# Run a reproducible build benchmark against port 9999
MC_PORT=9999 BUILD_FAST_MODE_ENABLED=true npm run benchmark -- wall_30x10
```

---

## Design workflow

For real buildings and named styles, the agent researches the subject and designs for recognizable proportions, strong composition and practical Minecraft interiors. It asks whether the user wants post-build validation, while the build engine always visits and checks that the complete construction volume is empty before placing blocks.

Block coordinates, batching and retries stay inside Aldeano Build MCP. This keeps tool calls and token use focused on research and design.

## Roadmap

- [x] Decoupled domain Services layer.
- [x] Dual-mode runtime (MCP Server + Dev Shell).
- [x] Automated local server setup and world reset scripts.
- [x] Typed error domain hierarchy.
- [x] 200+ unit and integration test suite with CI workflow.
- [x] World API with bounded summary, compact, and full scans.
- [x] Deterministic build primitives and structured outputs.
- [x] Blueprint engine, transformations, validation, planner, and executor.
- [x] Verification, bounded repair, progress, and build history.
- [x] Physical, fast, and cinematic execution strategies.
- [x] Location memory and improved navigation.
- [ ] Survival automation and inventory workflows.
- [ ] `.schem` and `.schematic` adapters.
- [ ] Streamable HTTP transport and remote security hardening.
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

This project retains the upstream [Apache License 2.0](LICENSE), including its original copyright notice. Modified inherited files identify the Aldeano Build MCP changes; attribution and the fork's scope are documented in [docs/attribution.md](docs/attribution.md). Dependency licenses remain their own.
