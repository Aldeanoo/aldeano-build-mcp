import { z } from 'zod';

export const letteringSchema = z.object({
  support: z.enum(['sign', 'book', 'display', 'blocks']),
  title: z.string().max(256).default(''),
  subtitle: z.string().max(512).default(''),
  body: z.string().max(4096).default(''),
  purpose: z.enum(['museum', 'wayfinding', 'heading']).default('museum'),
  alignment: z.enum(['left', 'center', 'right']).default('center'),
  width: z.number().int().min(30).max(480).optional(),
});
export type LetteringInput = z.input<typeof letteringSchema>;
export type LetteringRole = 'title' | 'subtitle' | 'body';
export interface LetteringLine { text: string; role: LetteringRole }
export interface LetteringLayout {
  version: 1;
  input: z.output<typeof letteringSchema>;
  width: number;
  panels: LetteringLine[][];
  theme: { foreground: string; background: string; title: string };
  warnings: string[];
}

export function cleanLetteringText(text: string): string {
  const normalized = text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  // Reject ambiguous/unsupported controls instead of silently losing content.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff§]/u.test(normalized)) throw new Error('TEXT_UNSUPPORTED_CONTROL: use plain text, without formatting codes');
  if ([...normalized].some(char=>{const code=char.codePointAt(0)!;return code>65535 || (code>=0xd800 && code<=0xdfff);})) throw new Error('TEXT_UNSUPPORTED_GLYPH: supplementary characters are not supported');
  return normalized;
}

/** Conservative widths for the default Minecraft font, including one-pixel spacing. */
export function textPixels(text: string, bold = false): number {
  return [...text].reduce((sum, char) => sum + (char === ' ' ? 4 : 'il.,:;!|\'' .includes(char) ? 3 : 'MW@'.includes(char) ? 7 : /[\u0020-\u00ff]/u.test(char) ? 6 : 9) + (bold && char !== ' ' ? 1 : 0), 0);
}

export function wrapText(text: string, width: number, bold = false, monospace = false): string[] {
  const lines: string[] = [];
  const measure = (line:string) => monospace ? [...line].length * 6 : textPixels(line,bold);
  for (const paragraph of cleanLetteringText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u).filter(Boolean)) {
      if (measure(word) > width) throw new Error(`TEXT_WORD_TOO_WIDE: '${word}' cannot fit; increase width or choose another support`);
      if (line && measure(`${line} ${word}`) > width) { lines.push(line); line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}

export function layoutLettering(value: LetteringInput): LetteringLayout {
  const input = letteringSchema.parse(value);
  if (![input.title, input.subtitle, input.body].some(text => text.trim())) throw new Error('TEXT_EMPTY');
  const maximum = input.support === 'sign' ? 90 : input.support === 'book' ? 114 : 480;
  const width = input.width ?? (input.support === 'display' ? 240 : input.support === 'blocks' ? 120 : maximum);
  if (width > maximum) throw new Error(`TEXT_WIDTH_EXCEEDED: ${input.support} maximum width is ${maximum}`);
  const lines: LetteringLine[] = [];
  for (const role of ['title', 'subtitle', 'body'] as const) {
    if (!input[role].trim()) continue;
    const text = input.support === 'blocks' ? input[role].toUpperCase() : input[role];
    if (input.support === 'book' && lines.length) lines.push({text:'',role});
    for (const line of wrapText(text, width, ['display','sign','book'].includes(input.support) && role === 'title',input.support==='blocks')) lines.push({ text: line, role });
  }
  const capacity = input.support === 'sign' ? 4 : input.support === 'book' ? 12 : 8;
  const panels: LetteringLine[][] = [];
  for (let index = 0; index < lines.length; index += capacity) panels.push(lines.slice(index, index + capacity));
  if (panels.length > (input.support === 'book' ? 100 : 32)) throw new Error('TEXT_TOO_MANY_PANELS');
  return { version: 1, input, width, panels, theme: input.support === 'book' ? {foreground:'#171717',background:'#F7F0D7',title:'#005577'} : { foreground: '#FFFFFF', background: '#171717', title: input.purpose === 'wayfinding' ? '#FFFF55' : '#55FFFF' }, warnings: [
    'Font metrics assume the default resource pack; custom fonts require visual review.',
    ...(input.support === 'blocks' ? ['Block lettering uses uppercase; preview rendered text before placing.'] : []),
    ...(input.support === 'book' ? ['Writable books use plain text with separate heading lines; colors and horizontal alignment are unavailable.'] : []),
    ...(input.support === 'sign' ? ['Minecraft signs center text; requested left/right alignment requires another support.'] : []),
  ] };
}

/** Text-only components: never accept click events, selectors or raw JSON from a caller. */
export function panelComponent(layout: LetteringLayout, panel: LetteringLine[]): object {
  return { text: '', extra: panel.map((line, index) => ({ text: `${index ? '\n' : ''}${line.text}`, color: line.role === 'title' ? layout.theme.title : layout.theme.foreground, bold: line.role === 'title' })) };
}
