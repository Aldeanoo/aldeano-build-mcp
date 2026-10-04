import type { BlockPlacement, BlockPosition } from '../build-types.js';
import type { LetteringLayout } from '../../services/lettering/text-layout.js';
import { checkGenerationBounds, checkGenerationCount, type PrimitiveGenerationLimits } from './generation-limits.js';

// Maintained 5x7 glyphs. Two extra rows reserve accents without changing baselines.
const rows: Record<string, string> = {
  A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',
  D:'11110/10001/10001/10001/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',
  G:'01111/10000/10000/10111/10001/10001/01111',H:'10001/10001/10001/11111/10001/10001/10001',I:'11111/00100/00100/00100/00100/00100/11111',
  J:'00111/00010/00010/00010/10010/10010/01100',K:'10001/10010/10100/11000/10100/10010/10001',L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',
  P:'11110/10001/10001/11110/10000/10000/10000',Q:'01110/10001/10001/10001/10101/10010/01101',R:'11110/10001/10001/11110/10100/10010/10001',
  S:'01111/10000/10000/01110/00001/00001/11110',T:'11111/00100/00100/00100/00100/00100/00100',U:'10001/10001/10001/10001/10001/10001/01110',
  V:'10001/10001/10001/10001/10001/01010/00100',W:'10001/10001/10001/10101/10101/11011/10001',X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100',Z:'11111/00001/00010/00100/01000/10000/11111',
  '0':'01110/10001/10011/10101/11001/10001/01110','1':'00100/01100/00100/00100/00100/00100/01110','2':'01110/10001/00001/00010/00100/01000/11111',
  '3':'11110/00001/00001/01110/00001/00001/11110','4':'00010/00110/01010/10010/11111/00010/00010','5':'11111/10000/10000/11110/00001/00001/11110',
  '6':'01110/10000/10000/11110/10001/10001/01110','7':'11111/00001/00010/00100/01000/01000/01000','8':'01110/10001/10001/01110/10001/10001/01110','9':'01110/10001/10001/01111/00001/00001/01110',
  ' ':'00000/00000/00000/00000/00000/00000/00000','-':'00000/00000/00000/11111/00000/00000/00000','.':'00000/00000/00000/00000/00000/00110/00110',
  ':':'00000/00110/00110/00000/00110/00110/00000','!':'00100/00100/00100/00100/00100/00000/00100','?':'01110/10001/00001/00010/00100/00000/00100',
  '/':'00001/00001/00010/00100/01000/10000/10000','(':'00010/00100/01000/01000/01000/00100/00010',')':'01000/00100/00010/00010/00010/00100/01000',
  ',':'00000/00000/00000/00000/00110/00100/01000',"'":'00100/00100/00000/00000/00000/00000/00000',
};

export function glyphRows(char: string): string[] {
  const decomposed = char.normalize('NFD');
  const base = rows[decomposed[0]];
  if (!base || !/^[A-Z0-9 .,:!?/()'-](?:[\u0301\u0303\u0308])?$/u.test(decomposed)) throw new Error(`TEXT_UNSUPPORTED_GLYPH: '${char}' is absent from the block font`);
  const accent = decomposed[1] === '\u0301' ? '00010' : decomposed[1] === '\u0303' ? '01010' : decomposed[1] === '\u0308' ? '01010' : '00000';
  return [accent, '00000', ...base.split('/')];
}

export type LetteringFacing = 'north' | 'south' | 'east' | 'west';
export function letteringPosition(origin: BlockPosition, column: number, height: number, depth: number, facing: LetteringFacing): BlockPosition {
  const direction = facing === 'north' ? [1,0,1] : facing === 'south' ? [-1,0,-1] : facing === 'east' ? [0,1,-1] : [0,-1,1];
  return { x: origin.x + column * direction[0] + (facing === 'north' || facing === 'south' ? 0 : depth * direction[2]), y: origin.y + height, z: origin.z + column * direction[1] + (facing === 'north' || facing === 'south' ? depth * direction[2] : 0) };
}

export function buildLettering(layout: LetteringLayout, origin: BlockPosition, facing: LetteringFacing, limits: PrimitiveGenerationLimits): BlockPlacement[] {
  const lines = layout.panels.flat();
  for (const line of lines) for (const char of line.text) glyphRows(char);
  const width = Math.max(...lines.map(line => line.text.length * 6), 1) + 2;
  const height = lines.length * 11 + 2;
  checkGenerationBounds(origin, letteringPosition(origin, width - 1, height - 1, 1, facing), limits);
  // Exact board and glyph count before materializing placements.
  checkGenerationCount(width * height + lines.reduce((sum,line)=>sum+[...line.text].reduce((count,char)=>count+glyphRows(char).join('').split('1').length-1,0),0), limits);
  const blocks: BlockPlacement[] = [];
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) blocks.push({ position: letteringPosition(origin,x,y,1,facing), block: 'black_concrete', category: 'structural' });
  lines.forEach((line, lineIndex) => {
    const lineWidth = line.text.length * 6 - 1;
    const offset = layout.input.alignment === 'left' ? 1 : layout.input.alignment === 'right' ? width - 1 - lineWidth : Math.floor((width - lineWidth) / 2);
    [...line.text].forEach((char, charIndex) => glyphRows(char).forEach((row, rowIndex) => [...row].forEach((pixel, column) => {
      if (pixel === '1') blocks.push({ position: letteringPosition(origin,offset + charIndex * 6 + column,height - 2 - lineIndex * 11 - rowIndex,0,facing), block: line.role === 'title' ? 'cyan_concrete' : 'white_concrete', category: 'decoration' });
    })));
  });
  return blocks;
}
