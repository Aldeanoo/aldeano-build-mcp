# World API

The World API reads bounded areas through one service and returns structured data.

`world.scan-region` and `world.get-region` accept three detail levels:

- `summary` returns bounds, palette counts, terrain height, nearby entities, and interesting blocks. This is the default.
- `compact` adds up to three sample coordinates per palette entry.
- `full` includes every scanned block and should be requested only for small regions.

`WORLD_MAX_SCAN_BLOCKS` defaults to `65536`. Requests above the limit fail with `LIMIT_EXCEEDED` instead of producing a large response.

Entity names and all other content originating in Minecraft are marked with `source: "minecraft_world"` and `trusted: false`.

`world.screenshot` renders a bounded region as a compact isometric PNG returned directly as MCP image content. It uses scanned block data, so it does not require a browser, desktop capture, or extra rendering server.
