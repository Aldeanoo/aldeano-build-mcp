import { z } from 'zod';

export const BlueprintBlockSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
  block: z.string().min(1),
  state: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  category: z.enum(['foundation', 'structural', 'wall', 'floor', 'roof', 'decoration']).optional(),
  section: z.string().min(1).optional(),
  dependsOn: z.array(z.object({ x: z.number().int(), y: z.number().int(), z: z.number().int() })).optional()
});

export const BlueprintSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(128),
  size: z.object({
    x: z.number().int().positive(),
    y: z.number().int().positive(),
    z: z.number().int().positive()
  }),
  palette: z.record(z.string().min(1)).optional(),
  blocks: z.array(BlueprintBlockSchema),
  metadata: z.record(z.unknown()).optional()
});
