/**
 * Renders the colouring book's drawings as PNG line art, fully inked, for checking them by eye and
 * for the paper book.
 *   npm run kids:render                 every page, into kids-render/ (not committed)
 *   npm run kids:render -- 3 --size 1600
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { SCENES as DRAWINGS } from '../src/kids/scenes.ts';
import { SCENES } from '../src/kids/story.ts';

const args = process.argv.slice(2);
const sizeAt = args.indexOf('--size');
const size = sizeAt >= 0 ? Number(args.splice(sizeAt, 2)[1]) : 900;
const only = args.map(Number).filter(Boolean);
const out = join(import.meta.dirname, '..', 'kids-render');
mkdirSync(out, { recursive: true });

/** The on-screen look (kids.css), as attributes: sharp's renderer reads no stylesheet classes. */
const STYLE = `<style>
  .r,.l{stroke:#2d2622;stroke-width:4.6;stroke-linejoin:round;stroke-linecap:round}
  .r{fill:#fff}.l{fill:none}.thin{stroke-width:3}.k{fill:#2d2622}.r.dark{fill:#2d2622}.shine{fill:#fff}.frame{stroke-width:5.5}
</style>`;

for (const [i, scene] of SCENES.entries()) {
  if (only.length && !only.includes(i + 1)) continue;
  const svg = DRAWINGS[scene.id]().replace('<defs>', `<defs>${STYLE}`);
  const file = join(out, `${i + 1}-${scene.id}.png`);
  await sharp(Buffer.from(svg), { density: 72 * (size / 600) }).flatten({ background: '#fff' }).png().toFile(file);
  console.log(file);
}
