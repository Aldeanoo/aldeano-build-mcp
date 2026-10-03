import { deflateSync } from 'node:zlib';
import type { RegionBounds } from '../build/build-types.js';
import { normalizeBounds } from '../build/build-types.js';
import type { WorldApiService } from './world-service.js';
import type { WorldBlock } from './world-types.js';

interface Color { r: number; g: number; b: number; a: number }
interface Point { x: number; y: number }

export interface WorldScreenshotResult {
  data: Buffer;
  width: number;
  height: number;
  renderedBlocks: number;
  bounds: RegionBounds;
}

const COLORS: Record<string, Color> = {
  stone: { r: 126, g: 126, b: 126, a: 255 },
  stone_bricks: { r: 118, g: 117, b: 111, a: 255 },
  cracked_stone_bricks: { r: 104, g: 101, b: 96, a: 255 },
  cobblestone: { r: 112, g: 110, b: 105, a: 255 },
  grass_block: { r: 92, g: 142, b: 62, a: 255 },
  dirt: { r: 133, g: 94, b: 66, a: 255 },
  oak_planks: { r: 176, g: 140, b: 82, a: 255 },
  dark_oak_planks: { r: 72, g: 47, b: 28, a: 255 },
  spruce_planks: { r: 112, g: 82, b: 48, a: 255 },
  glass: { r: 185, g: 224, b: 229, a: 190 },
  water: { r: 49, g: 91, b: 190, a: 205 },
  sand: { r: 219, g: 207, b: 157, a: 255 },
  bricks: { r: 151, g: 77, b: 66, a: 255 }
};

const AIR = new Set(['air', 'cave_air', 'void_air']);

export class WorldScreenshotRenderer {
  constructor(private readonly world: WorldApiService, private readonly maxRenderedBlocks = 12_000) {}

  capture(bounds: RegionBounds, width = 800, height = 600): WorldScreenshotResult {
    bounds = normalizeBounds(bounds.from, bounds.to);
    const imageWidth = Math.min(1024, Math.max(128, Math.floor(width)));
    const imageHeight = Math.min(1024, Math.max(128, Math.floor(height)));
    const scan = this.world.getRegion(bounds.from, bounds.to, 'full');
    const all = (scan.blocks ?? []).filter((block) => !AIR.has(block.name));
    const occupied = new Set(all.map((block) => this.key(block.position.x, block.position.y, block.position.z)));
    const visible = all.filter((block) => this.isVisible(block, occupied));
    if (visible.length > this.maxRenderedBlocks) throw new Error(`Screenshot has ${visible.length} visible blocks; maximum is ${this.maxRenderedBlocks}`);
    visible.sort((a, b) => (a.position.x + a.position.z) - (b.position.x + b.position.z) || a.position.y - b.position.y || a.position.x - b.position.x);

    const sizeX = bounds.to.x - bounds.from.x + 1;
    const sizeY = bounds.to.y - bounds.from.y + 1;
    const sizeZ = bounds.to.z - bounds.from.z + 1;
    const tileWidth = Math.max(4, Math.min(28, Math.floor(Math.min((imageWidth - 40) / (sizeX + sizeZ), (imageHeight - 40) / Math.max(2, (sizeX + sizeZ) / 4 + sizeY)))));
    const tileHeight = Math.max(2, Math.floor(tileWidth / 2));
    const blockHeight = Math.max(3, Math.floor(tileHeight * 1.25));
    const projected = visible.map((block) => {
      const x = block.position.x - bounds.from.x;
      const y = block.position.y - bounds.from.y;
      const z = block.position.z - bounds.from.z;
      return { block, x: (x - z) * tileWidth / 2, y: (x + z) * tileHeight / 2 - y * blockHeight };
    });
    const minX = Math.min(...projected.map((item) => item.x), 0) - tileWidth;
    const maxX = Math.max(...projected.map((item) => item.x), 0) + tileWidth;
    const minY = Math.min(...projected.map((item) => item.y), 0) - tileHeight;
    const maxY = Math.max(...projected.map((item) => item.y), 0) + blockHeight + tileHeight;
    const offsetX = (imageWidth - (maxX - minX)) / 2 - minX;
    const offsetY = (imageHeight - (maxY - minY)) / 2 - minY;
    const pixels = Buffer.alloc(imageWidth * imageHeight * 4);
    this.background(pixels, imageWidth, imageHeight);

    for (const item of projected) {
      const cx = Math.round(item.x + offsetX); const cy = Math.round(item.y + offsetY);
      const color = this.color(item.block.name);
      const top: Point[] = [{ x: cx, y: cy - tileHeight / 2 }, { x: cx + tileWidth / 2, y: cy }, { x: cx, y: cy + tileHeight / 2 }, { x: cx - tileWidth / 2, y: cy }];
      const left: Point[] = [top[3], top[2], { x: top[2].x, y: top[2].y + blockHeight }, { x: top[3].x, y: top[3].y + blockHeight }];
      const right: Point[] = [top[1], top[2], { x: top[2].x, y: top[2].y + blockHeight }, { x: top[1].x, y: top[1].y + blockHeight }];
      this.polygon(pixels, imageWidth, imageHeight, left, this.shade(color, 0.68));
      this.polygon(pixels, imageWidth, imageHeight, right, this.shade(color, 0.82));
      this.polygon(pixels, imageWidth, imageHeight, top, this.shade(color, 1.08));
    }
    return { data: this.png(pixels, imageWidth, imageHeight), width: imageWidth, height: imageHeight, renderedBlocks: visible.length, bounds };
  }

  private isVisible(block: WorldBlock, occupied: Set<string>): boolean {
    const { x, y, z } = block.position;
    return [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => !occupied.has(this.key(x + dx, y + dy, z + dz)));
  }
  private key(x: number, y: number, z: number): string { return `${x},${y},${z}`; }
  private color(name: string): Color {
    const known = COLORS[name]; if (known) return known;
    let hash = 0; for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return { r: 70 + (hash & 0x7f), g: 70 + ((hash >> 8) & 0x7f), b: 70 + ((hash >> 16) & 0x7f), a: 255 };
  }
  private shade(color: Color, factor: number): Color { return { r: Math.min(255, Math.round(color.r * factor)), g: Math.min(255, Math.round(color.g * factor)), b: Math.min(255, Math.round(color.b * factor)), a: color.a }; }
  private background(pixels: Buffer, width: number, height: number): void {
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4; const factor = y / height;
      pixels[i] = Math.round(184 + 35 * factor); pixels[i + 1] = Math.round(218 + 25 * factor); pixels[i + 2] = Math.round(244 + 8 * factor); pixels[i + 3] = 255;
    }
  }
  private polygon(pixels: Buffer, width: number, height: number, points: Point[], color: Color): void {
    const minY = Math.max(0, Math.ceil(Math.min(...points.map((point) => point.y))));
    const maxY = Math.min(height - 1, Math.floor(Math.max(...points.map((point) => point.y))));
    for (let y = minY; y <= maxY; y += 1) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]; const b = points[(i + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) for (let x = Math.max(0, Math.ceil(intersections[i])); x <= Math.min(width - 1, Math.floor(intersections[i + 1])); x += 1) this.blend(pixels, (y * width + x) * 4, color);
    }
  }
  private blend(pixels: Buffer, index: number, color: Color): void {
    const alpha = color.a / 255; pixels[index] = Math.round(color.r * alpha + pixels[index] * (1 - alpha)); pixels[index + 1] = Math.round(color.g * alpha + pixels[index + 1] * (1 - alpha)); pixels[index + 2] = Math.round(color.b * alpha + pixels[index + 2] * (1 - alpha)); pixels[index + 3] = 255;
  }
  private png(pixels: Buffer, width: number, height: number): Buffer {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) { const row = y * (width * 4 + 1); raw[row] = 0; pixels.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4); }
    const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), this.chunk('IHDR', header), this.chunk('IDAT', deflateSync(raw)), this.chunk('IEND', Buffer.alloc(0))]);
  }
  private chunk(type: string, data: Buffer): Buffer {
    const name = Buffer.from(type); const chunk = Buffer.alloc(data.length + 12); chunk.writeUInt32BE(data.length, 0); name.copy(chunk, 4); data.copy(chunk, 8); chunk.writeUInt32BE(this.crc32(Buffer.concat([name, data])), data.length + 8); return chunk;
  }
  private crc32(data: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
}
