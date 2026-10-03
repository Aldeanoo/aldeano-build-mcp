import type { BlockPosition } from '../../build/build-types.js';

export interface SavedLocation {
  name: string;
  position: BlockPosition;
  description?: string;
  createdAt: string;
}

export class LocationMemory {
  private readonly locations = new Map<string, SavedLocation>();
  remember(name: string, position: BlockPosition, description?: string): SavedLocation {
    const location = { name, position: { ...position }, description, createdAt: new Date().toISOString() };
    this.locations.set(name.toLowerCase(), location); return structuredClone(location);
  }
  get(name: string): SavedLocation | undefined { const value = this.locations.get(name.toLowerCase()); return value ? structuredClone(value) : undefined; }
  list(): SavedLocation[] { return [...this.locations.values()].map((value) => structuredClone(value)); }
  remove(name: string): boolean { return this.locations.delete(name.toLowerCase()); }
}
