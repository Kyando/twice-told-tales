/**
 * Lays out the colouring book's grids (src/kids/story.ts), one per scene and language, into
 * src/kids/levels/<lang>-<n>.json.
 *   npm run kids:generate                   every scene, both languages
 *   npm run kids:generate -- 3              only the third scene
 *   npm run kids:generate -- 3 --seed 7     the third, with other layouts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateLevel } from '../src/core/generate.ts';
import { BOOK, LANGS, SCENES } from '../src/kids/story.ts';

const dir = join(import.meta.dirname, '..', 'src', 'kids', 'levels');
mkdirSync(dir, { recursive: true });
const args = process.argv.slice(2);
const seedAt = args.indexOf('--seed');
const seedOffset = seedAt >= 0 ? Number(args.splice(seedAt, 2)[1]) : 0;
const only = args.map(Number).filter(Boolean);

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

const TRIES = 30;
let failed = 0;
SCENES.forEach((scene, i) => {
  const n = i + 1;
  if (only.length && !only.includes(n)) return;
  for (const lang of LANGS) {
    const text = scene[lang];
    const id = `${lang}-${n}-${scene.id}`;
    const spec = {
      id,
      book: BOOK.id,
      chapter: n,
      title: text.title,
      rows: text.rows,
      cols: text.cols,
      story: { text: text.text.normalize('NFC'), image: '', caption: '', credit: '' },
    };
    // Small boards with long passages can be hard to lay out: try a few more seeds before giving up.
    let def = null;
    let tries = 0;
    for (; tries < TRIES && !def; tries++) def = generateLevel(spec, hash(id) + (text.seed ?? 0) + seedOffset + tries);
    if (!def) {
      console.error(`✗ ${id}: no valid layout in ${TRIES} seeds — change a word, or the board's size`);
      failed++;
      continue;
    }
    if (tries > 1) console.log(`  (${id}: seed +${tries - 1}; set seed: ${tries - 1} in story.ts to keep it)`);
    const board = { rows: def.rows, cols: def.cols, grid: def.grid, words: def.words };
    writeFileSync(join(dir, `${lang}-${n}.json`), `${JSON.stringify(board, null, 1).replace(/\[\s+([\d,\s]+?)\s+\]/g, (_, nums: string) => `[${nums.split(/,\s*/).join(', ')}]`)}\n`);
    console.log(`✓ ${id}\n${def.grid.map((r) => `    ${r.split('').join(' ')}`).join('\n')}`);
  }
});
process.exit(failed ? 1 : 0);
