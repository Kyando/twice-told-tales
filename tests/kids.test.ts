import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { blanksOf, validateLevel } from '../src/core/puzzle.ts';
import { SCENES as DRAWINGS } from '../src/kids/scenes.ts';
import { BOOK, LANGS, SCENES } from '../src/kids/story.ts';

const board = (lang: string, n: number) => JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'kids', 'levels', `${lang}-${n}.json`), 'utf8'));

describe('the colouring book', () => {
  SCENES.forEach((scene, i) => {
    const n = i + 1;
    const drawing = DRAWINGS[scene.id]?.() ?? '';
    const keys = new Set([...drawing.matchAll(/data-k="([^"]*)"/g)].map((m) => m[1]));

    it(`${scene.id} has a drawing`, () => {
      expect(drawing).toContain('<svg');
    });

    for (const lang of LANGS) {
      const text = scene[lang];
      it(`${scene.id} (${lang}): its board is valid and matches the scene`, () => {
        const b = board(lang, n);
        const def = { id: scene.id, book: BOOK.id, chapter: n, title: text.title, ...b, story: { text: text.text, image: '', caption: '', credit: '' } };
        expect(validateLevel(def)).toEqual([]);
      });

      it(`${scene.id} (${lang}): every word inks a part of the drawing`, () => {
        expect(Object.keys(text.ink).sort()).toEqual(blanksOf(text.text).sort());
        for (const [word, parts] of Object.entries(text.ink)) {
          expect(parts.length, word).toBeGreaterThan(0);
          for (const k of parts) expect(keys, `${word} → ${k}`).toContain(k);
        }
      });
    }
  });
});
