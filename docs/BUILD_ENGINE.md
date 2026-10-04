# Build Engine

The build engine turns deterministic block lists into ordered, bounded Minecraft operations.

## Flow

`Blueprint -> BuildPlanner -> BuildPlan -> Site Preflight -> PlacementQueue -> BuildExecutionStrategy -> Optional Verifier -> Repair`

`BuildService` owns build IDs, progress, cancellation, pause/resume, history, limits and metrics. MCP handlers only validate input and serialize its results.

Primitive tools check configured dimensions and candidate volume before generating placements. Exact line, wall, floor, column and box counts are checked before allocation; spheres, cylinders and detailed roofs stop before exceeding `min(BUILD_MAX_BLOCKS, BUILD_MAX_QUEUE)`. Hollow boxes use their shell count, not the solid volume. Candidate work is bounded by `BUILD_PREFLIGHT_MAX_BLOCKS`, including air in hollow shapes. Custom limits remain supported; tool inputs are unchanged. Core primitive helpers accept an optional final limits argument for scripts that also need bounded generation.

## Site preflight and validation choice

Every construction operation has a mandatory preflight. The bot travels to the site, loads the nearby chunks and inspects the complete planned bounding box internally. Placement starts only when every position is readable and empty. Occupied and unavailable sites return compact `SITE_OCCUPIED` and `SITE_UNAVAILABLE` errors. Region editing operations are exempt because their purpose is to modify existing blocks.

Site inspection uses block-data queries inside the MCP, never a screenshot. Only `air`, `cave_air` and `void_air` count as empty. An unreadable position blocks construction. Visual inspection is performed only when the user explicitly requests images, iterations or visual corrections, regardless of build size.

Post-build structural validation is a separate choice. The agent asks the user before construction and passes the answer through `verifyAfterBuild`. If the field is omitted, `BUILD_VERIFY` supplies the fallback. Automatic repair runs only when post-build validation is enabled and differences are found.

The scan and all coordinate work remain inside the MCP. The model receives a compact result rather than one response per block.

## Hollow construction

`build-hollow-box` creates a cuboid shell. `build-cylinder` and `build-sphere` accept `hollow: true`. These operations leave the interior untouched; mandatory site preflight ensures it starts as air. For usable buildings, a blueprint should specify walls, floors, ceilings and supports while omitting interior air. Hollow interiors do not automatically carve existing terrain or structures.

## Modes

- `physical` uses Mineflayer movement, inventory, digging and placement. It is the default.
- `fast` uses only the internal, bounded `/setblock` operation. It must be enabled with `BUILD_FAST_MODE_ENABLED=true` and is intended for controlled creative servers.
- `cinematic` uses the fast strategy while adding a delay between layers.

There is no arbitrary command tool.

## Configuration

| Variable | Default | Meaning |
|---|---:|---|
| `BUILD_MODE` | `physical` | `physical`, `fast`, or `cinematic` |
| `BUILD_VERIFY` | `true` | Verify expected blocks after execution |
| `BUILD_AUTO_REPAIR` | `true` | Repair only verification differences |
| `BUILD_MAX_BLOCKS` | `10000` | Maximum blocks in one operation |
| `BUILD_BATCH_SIZE` | `100` | Blocks per queue batch |
| `BUILD_CONCURRENCY` | `4` | Concurrent placements |
| `BUILD_RETRY_COUNT` | `2` | Retries per placement |
| `BUILD_TIMEOUT_MS` | `30000` | Timeout per placement |
| `BUILD_MAX_REPAIR_PASSES` | `3` | Maximum repair cycles |
| `BUILD_FAST_MODE_ENABLED` | `false` | Explicitly enable bounded creative commands |
| `BUILD_FAST_COMMAND_INTERVAL_MS` | `20` | Minimum spacing between internal fast commands |
| `BUILD_PREFLIGHT_MAX_BLOCKS` | `1000000` | Maximum positions inspected before a construction |
| `BUILD_PREFLIGHT_NAVIGATION_TIMEOUT_MS` | `45000` | Maximum navigation time to reach the inspection site |

Build plans retain named sections, so a later multi-agent scheduler can partition work without changing the blueprint format.
