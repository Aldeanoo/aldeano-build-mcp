# Contributing to Aldeano Build MCP

Thank you for your interest in contributing to **Aldeano Build MCP**! This guide outlines our branching strategy, architectural rules, coding standards, testing workflow, and pull request guidelines.

---

## 1. Branching Strategy

We follow a Git flow model optimized for quality and release stability:

- **`main`**: Production-ready branch. Only release tags and vetted merges from `develop` enter `main`.
- **`develop`**: The primary integration branch. All feature branches and bugfixes are based on and merged into `develop`.
- **Branch naming convention**:
  - `feature/<short-description>`: New tools, services, or capabilities (e.g., `feature/pathfinding-climb`, `feature/schematic-loader`).
  - `fix/<issue-description>`: Bug fixes (e.g., `fix/block-placement-collision`, `fix/chat-encoding`).
  - `docs/<subject>`: Documentation updates, architectural guides, README revisions (e.g., `docs/update-architecture`, `docs/clarify-quickstart`).
  - `refactor/<module>`: Refactoring code without functional changes.
  - `test/<suite>`: Adding or reorganizing tests.

### Workflow Example:
```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-cool-feature

# Make changes, write tests, commit
git commit -m "feat(services): implement block raycasting query"

git push origin feature/my-cool-feature
# Open Pull Request against develop
```

---

## 2. Fundamental Architecture Rule

> [!IMPORTANT]
> **"All Minecraft actions must live in Services, not directly inside MCP tool handlers."**

When adding or modifying capabilities:
1. **Never** put game logic, pathfinder calls, or raw `mineflayer.Bot` mutations directly into tool handlers inside `src/tools/`.
2. **Implement in `src/services/`**: Create or extend the relevant domain service (e.g., `MovementService`, `BlocksService`, `InventoryService`, `CraftingService`).
3. **Write Unit Tests**: Add unit tests for the service method in `tests/unit/services.test.ts` (using mock bots or unit fixtures).
4. **Wrap in Tool Handler**: Register the tool in `src/tools/` as a lightweight adapter that parses/validates inputs using Zod, delegates to the service, and formats the output string.

This rule ensures that all capabilities are equally accessible in **MCP Mode**, **Dev Shell Mode**, and automated scripts.

---

## 3. Tool Namespacing Convention

For future tool development, adhere to our standardized domain namespace convention:

- `movement.*`: Actions involving bot locomotion, looking, pathfinding, jumping (`movement.moveTo`, `movement.lookAt`, `movement.jump`).
- `blocks.*`: Querying, placing, digging, and scanning blocks (`blocks.place`, `blocks.dig`, `blocks.info`, `blocks.find`).
- `inventory.*`: Listing, searching, equipping, dropping items (`inventory.list`, `inventory.equip`, `inventory.drop`).
- `world.*`: Scanning environmental state, detecting entities, time of day, weather, gamemode (`world.entities`, `world.gamemode`, `world.scan`).
- `build.*`: High-level structural construction, blueprint layout, multi-block placement (`build.wall`, `build.schematic`).
- `system.*`: Bot diagnostics, connection status, session reset, health reporting (`system.status`, `system.reconnect`).

*(Existing tools maintain backward-compatible aliases like `get-position`, `move-to-position`, `place-block`, etc.)*

---

## 4. Testing Guidelines

Quality is central to Aldeano Build MCP. We maintain tests in two distinct categories:

### 4.1. Unit Tests (`tests/unit/`)
- Fast, mock-based, and run completely offline without requiring a live Minecraft server.
- Run unit tests with:
  ```bash
  npm test
  # or
  npm run test:unit
  ```
- All unit tests must pass before opening a PR.

### 4.2. Integration & Smoke Tests (`tests/integration/`)
- Test real network handshakes, bot spawn sequences, physics, and world interactions.
- Run integration tests (offline-safe):
  ```bash
  npm run test:integration
  ```
- Run live Minecraft integration tests (requires local server on port 25565):
  ```bash
  npm run test:minecraft
  ```

---

## 5. TypeScript & Coding Standards

- **Language Target**: ES2022, NodeNext modules, strict TypeScript mode (`"strict": true`).
- **Linter & Formatter**: ESLint 9 with typescript-eslint.
  ```bash
  npm run lint
  npm run lint:fix
  ```
- **Error Handling**: Use the typed errors from `src/errors/index.js` (`AldeanoError`, `MinecraftConnectionError`, `MovementError`, `BlockPlacementError`, `InventoryError`, `TimeoutError`, `ValidationError`). Do not throw generic untyped errors.
- **Logging**: Never use `console.log` in server code (this corrupts stdio JSON-RPC). Always import `log` or `logger` from `src/logger/index.js`, which safely writes to `stderr`.

---

## 6. Pull Request Process

1. Ensure all dependencies are clean (`npm ci`).
2. Run the linter and fix any issues:
   ```bash
   npm run lint
   ```
3. Run the full unit test suite:
   ```bash
   npm test
   ```
4. Verify TypeScript compilation:
   ```bash
   npm run build
   ```
5. Ensure your PR is targeting the **`develop`** branch (not `main`).
6. Include a clear title and description explaining what was added or fixed, along with instructions for how reviewers can test your changes.
