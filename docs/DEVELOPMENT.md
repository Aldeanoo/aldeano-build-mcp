# Development

New Minecraft behavior belongs in `src/build`, `src/world`, or a domain service. MCP handlers validate and serialize calls; they do not contain gameplay logic or global bot state.

For file placement, project scripts and generated artifacts, follow [the repository map](REPOSITORY_LAYOUT.md) and the rules in [AGENTS.md](../AGENTS.md).

For the local server, prerequisites and MCP connection, follow [the installation guide](installation.md). Do not point destructive tests at a project world or capture screenshots as part of ordinary quality checks.

Quality checks:

```bash
npm run doctor
```

Changes that affect real gameplay require Doctor's live integrations, not just offline checks. Preserve public tool schemas or provide a migration path.

Doctor includes build, lint, unit tests, live integration and benchmarks in an isolated world, then saves JSON/Markdown reports. See [DOCTOR.md](DOCTOR.md) and [the v2 result migration](BUILD_RELIABILITY.md). `--offline` is explicitly partial; individual commands remain available for focused debugging.

## Parallel construction workers

Use one coordinator for preflight, cleanup, plan generation and final reporting. `ParallelFastExecutor` distributes typed fill/setblock operations across 1–4 independent bot connections. It splits the plan into non-overlapping X slabs, including any fill that crosses a boundary, and preserves operation order within each slab. Each worker needs its own Minecraft username and loaded chunks for its region.

The Cristo CLI supports:

```powershell
npx.cmd tsx projects/cristo/scripts/build-cristo.ts --workers=4
```

`--rebuild-hollow` explicitly clears and rebuilds the previous Cristo site at `(295, -60, 39)`. `--verify-only` checks that existing structure without rebuilding it. Do not run cleanup concurrently with construction.

Workers execute small bursts on physics-tick events, with no per-command `sleep` or wall-clock build deadline. Tick events provide pacing rather than confirming placement; structural verification supplies the final outcome. A disconnect or cancellation stops the worker pool. The CLI closes workers, closes the coordinator connection and exits after reporting completion or failure.

Only parallelize independent sections. When attachments need supports in another section, execute a support phase first and await its completion before the attachment phase. Existing navigation and connection safeguards still apply to individual operations; they are not a maximum duration for the overall build.

Worker positioning uses bounded typed creative teleport when fast positioning is explicitly enabled; arrival and destination clearance must pass. It does not change an already running build, physical mode, or mandatory site preflight.

If using separate terminals or scripts, give each one an exclusive section and username, start them after the coordinator's preflight, and await all their exits before verification. Splitting scripts is for partitioning work; a tool returning a running session does not require restarting a build. Keep the running session and collect its result. More workers do not guarantee proportional speed because the Minecraft server processes the commands.
