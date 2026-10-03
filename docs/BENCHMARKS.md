# Benchmarks

The recommended entry point is `npm run doctor`: it runs every test and all seven live benchmark cases in a fresh isolated localhost Minecraft server, printing a table and saving `artifacts/doctor/latest.md` and `latest.json`. See [DOCTOR.md](DOCTOR.md). `npm run doctor -- --offline` measures planning only and reports partial validation.

Run a named live benchmark against the configured Minecraft server:

```bash
MC_PORT=9999 BUILD_FAST_MODE_ENABLED=true npm run benchmark -- wall_30x10
MC_PORT=9999 BUILD_FAST_MODE_ENABLED=true npm run benchmark -- small-house
```

Available cases are `wall_10x5`, `wall_30x10`, `blocks_6000`, `house_small`, `tower_medium`, `sphere_15`, and `castle_section`. Aliases with hyphens are accepted. `npm run benchmark -- --all` selects all cases; `--report=<path>` saves JSON.

The runner reports final unique expected/verified blocks, compressed command count, planning time, total duration and verified blocks/s. Total time includes mandatory site preflight, execution, verification and any bounded repair. Offline measurements never claim placed blocks. Standalone live benchmarks target the configured server and require clear sites; they do not reset or overwrite occupied sites. Doctor supplies isolation automatically. Publish only results produced against a documented Minecraft version and unchanged case definition.
