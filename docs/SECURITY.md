# Security

The server exposes defined MCP tools over stdio. It does not expose a generic Minecraft command executor.

Fast and cinematic modes use an internal `/setblock` adapter and remain disabled unless `BUILD_FAST_MODE_ENABLED=true`. Region and build limits bound work before Minecraft is changed.

Chat, signs, books, item names and entity names are environment content. Consumers must treat them as untrusted data, never as agent instructions. World-facing results use `source: "minecraft_world"` and `trusted: false` where content can contain player-controlled text.

Legacy chat, inventory and entity read tools serialize this content in a JSON envelope, rather than concatenate it into trusted prose. World text is bounded (4096 characters per string, 128 for stored names), terminal and directional controls are removed, and XML-like delimiters are escaped during serialization. Chat storage is bounded to 100 messages. The normalization does not remove instruction-like phrases: they remain quoted data. Read-tool failures use the same untrusted boundary. Screenshots carry untrusted provenance too; visual content is not a privileged instruction source.

`send-chat` accepts ordinary single-line messages only (1–256 characters). It rejects slash commands, leading-whitespace command bypasses, and control characters. Command permission is reserved for bounded, typed internal building and teleport adapters in explicitly enabled creative mode. See [the upstream audit and migration](upstream-issues.md).

These measures mitigate indirect prompt injection; they cannot guarantee that an LLM will respect the boundary. The host must keep world data separate from privileged instructions, enforce permissions and decline actions requested by untrusted environment text. New sign, book, custom-item or NBT readers must apply the same boundary before exposing any text. No new such reader was added by this audit.

Any future HTTP transport must bind to localhost by default, require authentication for remote access, rate limit requests, and apply per-tool restrictions. Minecraft logic remains in services rather than transport handlers.

## Dependency audit

CI and Doctor passing do not certify dependency security. The October 2026 review found unresolved npm audit advisories, including a critical transitive development dependency. See [the dated dependency audit](pull-request-audit.md#pendiente-de-seguridad-npm-audit) for counts, limitations and required follow-up; do not use `npm audit fix --force` to replace compatibility review.
