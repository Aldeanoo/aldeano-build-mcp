# World API

The World API reads bounded areas through one service and returns structured data.

## Read coverage and migration

Responses now add `coverage` with `version: 1`, `requestedBlocks`, `readBlocks`, `unavailableBlocks` and `complete`. A missing block is unavailable, never assumed to be air. `scannedBlocks` retains its previous meaning: the requested inclusive volume. Palette counts and full block lists contain only readable positions. Input schemas and existing response fields are unchanged; consumers may ignore the additions, but should treat responses without coverage as having unknown completeness.

Heightmap columns add counts, `status` (`complete`, `partial`, `unavailable`) and `heightKnown`. Missing positions above an observed surface make its height uncertain; missing positions below it do not. Existing `min`/`max` remain observed heights. Region `height.complete` states whether all column heights are known, independently of full block coverage. Loaded columns containing only air have a known null surface.

Region scans calculate coverage and heights in one pass. Standalone heightmaps read the whole bounded volume to report accurate coverage. Both enforce `WORLD_MAX_SCAN_BLOCKS` before reading.

`world.scan-region` and `world.get-region` accept three detail levels:

- `summary` returns bounds, palette counts, terrain height, nearby entities, and interesting blocks. This is the default.
- `compact` adds up to three sample coordinates per palette entry.
- `full` includes every scanned block and should be requested only for small regions.

`WORLD_MAX_SCAN_BLOCKS` defaults to `65536`. Requests above the limit fail with `LIMIT_EXCEEDED` instead of producing a large response.

Entity names and all other content originating in Minecraft are marked with `source: "minecraft_world"` and `trusted: false`.

`world.screenshot` renders a bounded region as a compact isometric PNG returned directly as MCP image content. It uses scanned block data, so it does not require a browser, desktop capture, or extra rendering server.
