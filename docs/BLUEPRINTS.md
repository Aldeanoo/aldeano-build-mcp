# Blueprints

Blueprints use relative integer coordinates. The executor adds an explicit origin when it creates a build plan.

```json
{
  "version": 1,
  "name": "small_house",
  "size": { "x": 10, "y": 7, "z": 8 },
  "palette": { "1": "oak_planks", "2": "stone_bricks" },
  "blocks": [
    { "x": 0, "y": 0, "z": 0, "block": "stone_bricks", "category": "foundation", "section": "base" }
  ]
}
```

Optional block fields are `state`, `category`, `section`, and `dependsOn`. Categories are ordered as foundation, structural, wall, floor, roof, then decoration.

`BlueprintValidator` checks the schema, dimensions, configured limits, duplicates, coordinates, Minecraft block names and declared dependencies before execution.

`BlueprintTransformer` supports `translate`, `rotate90`, `rotate180`, `rotate270`, `mirrorX`, and `mirrorZ`. Rotation and mirroring also update cardinal `facing` state.

Use `build.preview` before `build.blueprint` to get dimensions, material counts, the world bounding box, estimated time, warnings, and errors without changing Minecraft.
