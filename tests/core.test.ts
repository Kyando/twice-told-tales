import { describe, expect, it } from 'vitest';
import { BOOKS, unintroducedNames } from '../src/core/books.ts';
import { easySpread, easyStart, generateLevel } from '../src/core/generate.ts';
import { findPaths, isPath, turns } from '../src/core/grid.ts';
import { existsSync } from 'node:fs';
import { decoysOf, endsSentence, passageParts, passageTokens } from '../src/core/passage.ts';
import { blanksOf, buildPuzzle, insideWord, matchTrace, validateLevel } from '../src/core/puzzle.ts';
import type { LevelDef } from '../src/core/types.ts';
import { Session } from '../src/game/session.ts';
import { emptyProgress } from '../src/game/save.ts';
import { en } from '../src/i18n/en.ts';
import { SPECS } from '../scripts/level-specs.ts';
import { pieceOutline } from '../src/ui/shape.ts';
import { steer, type SteerState } from '../src/core/steer.ts';

const files = import.meta.glob<LevelDef>('../src/levels/*.json', { eager: true, import: 'default' });
const levels = Object.keys(files).sort().map((k) => files[k]);

describe('grid', () => {
  it('only accepts orthogonal, non-repeating paths', () => {
    expect(isPath([0, 1, 5, 4], 4, 4)).toBe(true);
    expect(isPath([0, 5], 4, 4)).toBe(false); // diagonal
    expect(isPath([3, 4], 4, 4)).toBe(false); // wraps a row
    expect(isPath([0, 1, 0], 4, 4)).toBe(false);
  });

  it('finds every bent path spelling a word', () => {
    expect(findPaths('CATX', 2, 2, 'CAT')).toEqual([]);
    expect(findPaths('CAXT', 2, 2, 'CAT')).toEqual([[0, 1, 3]]);
  });
});

describe('chapters', () => {
  it('ship one file per spec, in order', () => {
    expect(levels.map((l) => l.id)).toEqual(SPECS.map((s) => s.id));
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s is valid', (_, def) => {
    expect(validateLevel(def)).toEqual([]);
  });

  it.each(levels.map((l) => [l.id, l] as const))('%s matches its spec', (_, def) => {
    const spec = SPECS.find((s) => s.id === def.id)!;
    expect([def.rows, def.cols, def.book, def.chapter]).toEqual([spec.rows, spec.cols, spec.book, spec.chapter]);
    expect(def.story).toEqual(spec.story);
    expect(def.words.map((w) => w.text)).toEqual(blanksOf(spec.story.text));
  });

  it('come from known books, a book at a time, each in reading order', () => {
    for (const def of levels) expect(BOOKS[def.book]).toBeDefined();
    // One run per book (its chapters aren't scattered among another's). New books are added at the
    // end, so the files keep their numbers; the shelf's order is BOOKS's.
    const runs = levels.map((l) => l.book).filter((b, i, all) => b !== all[i - 1]);
    expect(runs).toEqual([...new Set(runs)]);
    for (const book of runs) {
      const chapters = levels.filter((l) => l.book === book).map((l) => l.chapter);
      expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    }
  });

  it('give young readers words that run straight or bend once', () => {
    for (const def of levels.filter((l) => BOOKS[l.book].young)) {
      for (const w of def.words) expect(turns(w.path), `${def.id}: ${w.text}`).toBeLessThanOrEqual(1);
    }
  });

  it.each(Object.keys(BOOKS))('%s introduces every name before hiding it', (book) => {
    const passages = SPECS.filter((s) => s.book === book).map((s) => s.story.text);
    expect(unintroducedNames(passages, BOOKS[book].names)).toEqual([]);
  });

  it('flags a name hidden before the player has met it', () => {
    const names = ['DARCY', 'MERYTON'];
    expect(unintroducedNames(['At the ball in Meryton, Mr. Darcy is proud.', '{DARCY} snubs her at {MERYTON}.'], names)).toEqual([]);
    expect(unintroducedNames(['Mr. {DARCY} snubs her.'], names)).toEqual(['DARCY is hidden in passage 1 before it is introduced']);
    // Met earlier in the same passage counts too.
    expect(unintroducedNames(['Mr. Darcy arrives. Later, {DARCY} leaves.'], names)).toEqual([]);
  });

  it('never repeat a word within a chapter', () => {
    for (const def of levels) expect(new Set(def.words.map((w) => w.text)).size).toBe(def.words.length);
  });

  it('rejects a passage whose blanks miss a word', () => {
    const def = structuredClone(levels[0]);
    def.story.text = def.story.text.replace(/\{[A-Z]+\}/, 'something');
    expect(validateLevel(def)).toContain('story blanks do not match the level words');
  });

  it('rejects a letter cell that belongs to no word', () => {
    const def = generateLevel({ ...SPECS[0], easy: undefined, id: 'holes', rows: 2, cols: 4, holes: [4], story: { ...SPECS[0].story, text: '{LAZY} {FOX}' } }, 3)!;
    expect(validateLevel(def)).toEqual([]);
    expect(def.grid[1][0]).toBe('.');
    def.grid[1] = 'Q' + def.grid[1].slice(1);
    expect(validateLevel(def)).toContain('every letter must belong to exactly one word');
  });
});

describe('generator', () => {
  it('lays out a valid chapter deterministically', () => {
    const plain = { ...SPECS[0], easy: undefined };
    const a = generateLevel(plain, 42, 20);
    const b = generateLevel(plain, 42, 20);
    expect(a).not.toBeNull();
    expect(validateLevel(a!)).toEqual([]);
    expect(a).toEqual(b);
  });

  it('starts the first chapters’ easy words straight and far apart', () => {
    for (const spec of SPECS.filter((s) => s.easy)) {
      const def = levels.find((l) => l.id === spec.id)!;
      expect(def.words.filter((w) => easyStart(w.path, def.cols)).length, spec.id).toBeGreaterThanOrEqual(spec.easy!);
      expect(easySpread(def.words, spec.easy!, def.cols), spec.id).toBeGreaterThanOrEqual(Math.ceil((def.rows + def.cols) / spec.easy!));
    }
  });

  it('refuses words that do not fill the grid', () => {
    expect(() => generateLevel({ ...SPECS[0], rows: 2, cols: 2 }, 1)).toThrow(/letters for 4 cells/);
  });
});

describe('session', () => {
  const puzzle = buildPuzzle(levels[0]);
  const word = puzzle.words[0];

  it('finds a word traced either way, once', () => {
    const s = new Session(puzzle, emptyProgress(), () => {});
    expect(matchTrace(puzzle, [...word.path].reverse())).toBe(0);
    expect(s.submit([...word.path].reverse())).toMatchObject({ kind: 'found', word: { text: word.text } });
    expect(s.submit(word.path)).toEqual({ kind: 'miss' });
    expect(s.progress.misses).toBe(1);
    expect(word.path.every((c) => s.ownerAt(c) === 0)).toBe(true);
  });

  it('is solved once every word is found, and restores from saved progress', () => {
    const progress = emptyProgress();
    const s = new Session(puzzle, progress, () => {});
    for (const w of puzzle.words) s.submit(w.path);
    expect(s.solved).toBe(true);
    expect(progress.done).toBe(true);
    expect(new Session(puzzle, progress, () => {}).foundCount).toBe(puzzle.words.length);
    s.reset();
    expect(s.foundCount).toBe(0);
    expect(progress.done).toBe(true);
  });
});

describe('i18n', () => {
  it('has a one and other form for every counted message', () => {
    const keys = Object.keys(en);
    for (const k of keys.filter((k) => k.endsWith('_one'))) expect(keys).toContain(k.replace(/_one$/, '_other'));
  });
});

describe('piece outline', () => {
  const corners = (d: string) => (d.match(/Q/g) ?? []).length;
  const loops = (d: string) => (d.match(/Z/g) ?? []).length;

  it('joins neighbouring cells across the gap', () => {
    // A single cell, a row of three (one shape) and an L.
    expect(corners(pieceOutline([0], 4, 10, 2, 0))).toBe(4);
    const row = pieceOutline([0, 1, 2], 4, 10, 2, 0);
    expect([corners(row), loops(row)]).toEqual([4, 1]);
    expect(row).toContain('34,0');
    expect(corners(pieceOutline([0, 1, 5], 4, 10, 2, 0))).toBe(6);
  });

  it('puts inner corners at the gap, not across it', () => {
    // An L: cells 0, 1 (row 0) and 4 (row 1, col 0) on a 4-wide board; the inner corner is at (10, 10).
    expect(pieceOutline([0, 1, 4], 4, 10, 2, 0)).toContain('10,10');
  });

  it('does not wrap across the board edge', () => {
    // Cell 3 (end of row 0) and 4 (start of row 1) are not neighbours.
    expect(loops(pieceOutline([3, 4], 4, 10, 2, 0))).toBe(2);
  });

  it('keeps a hole as its own loop', () => {
    const ring = [0, 1, 2, 6, 10, 9, 8, 4]; // around cell 5
    expect(loops(pieceOutline(ring, 4, 10, 2, 0))).toBe(2);
  });
});

describe('steering a drag', () => {
  // A 4×4 board; cell (row, col) is row * 4 + col and its centre is at (col, row).
  const drag = (start: number, points: [number, number][], blocked: number[] = []): number[] => {
    let st: SteerState = { trace: [start], dir: 0 };
    let [pu, pv] = [start % 4, Math.floor(start / 4)];
    for (const [u, v] of points) {
      const n = Math.max(1, Math.ceil(Math.hypot(u - pu, v - pv) / 0.2));
      for (let i = 1; i <= n; i++) st = steer(st, pu + ((u - pu) * i) / n, pv + ((v - pv) * i) / n, 4, 4, (c) => !blocked.includes(c));
      [pu, pv] = [u, v];
    }
    return st.trace;
  };

  it('follows a loose straight drag, through the gaps', () => {
    expect(drag(0, [[3, 0.4]])).toEqual([0, 1, 2, 3]);
  });
  it('fills in every cell of a fast swipe', () => {
    expect(drag(0, [[0, 3]])).toEqual([0, 4, 8, 12]);
  });
  it('turns a cut corner through the cell the finger passed nearer', () => {
    expect(drag(0, [[1.2, 0.1], [1.4, 1]])).toEqual([0, 1, 5]);
    expect(drag(0, [[0.1, 1.2], [1, 1.4]])).toEqual([0, 4, 5]);
  });
  it('goes round the other side of a corner it cannot use', () => {
    expect(drag(0, [[0.9, 0.9]], [1])).toEqual([0, 4, 5]);
  });
  it('steps back along the trace', () => {
    expect(drag(0, [[3, 0], [1, 0]])).toEqual([0, 1]);
  });
  it('folds back onto an earlier tile it is dragged into', () => {
    // 0 → 1 → 5 → 4, then up into 0 again.
    expect(drag(0, [[1, 0], [1, 1], [0, 1], [0, 0]])).toEqual([0]);
  });
  it('does not wander into the next row on a slightly crooked drag', () => {
    expect(drag(0, [[1, 0.55], [2, 0.55]])).toEqual([0, 1, 2]);
  });
});

describe('pictures', () => {
  it('asks Wikimedia for a standard thumbnail width, from originals and thumbnails alike', async () => {
    const { commonsThumb } = await import('../src/ui/picture.ts');
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/4/4d/Thomson-PP03.jpg', 330)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Thomson-PP03.jpg/330px-Thomson-PP03.jpg',
    );
    expect(commonsThumb('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Thomson-PP-Ch27.JPG/1280px-Thomson-PP-Ch27.JPG', 330)).toBe(
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Thomson-PP-Ch27.JPG/330px-Thomson-PP-Ch27.JPG',
    );
  });
  it('crops stay inside the picture', () => {
    for (const def of levels) {
      const crop = def.story.crop;
      if (!crop) continue;
      const [l, t, r, b] = crop;
      expect(0 <= l && l < r && r <= 1 && 0 <= t && t < b && b <= 1, def.id).toBe(true);
    }
  });
});

describe('the passage as the clue', () => {
  const names = ['DARCY', 'ELIZABETH'];

  it('writes hidden words as the book would', () => {
    const parts = passageParts('{DARCY} looks. “She is {TOLERABLE}.” {LAUGH} they do, at {ELIZABETH}.', names);
    expect(parts.filter((p) => p.word).map((p) => p.text)).toEqual(['Darcy', 'tolerable', 'Laugh', 'Elizabeth']);
    expect(parts.map((p) => p.text).join('')).toBe('Darcy looks. “She is tolerable.” Laugh they do, at Elizabeth.');
  });

  it('lists the passage words that are not hidden', () => {
    expect(decoysOf('{DARCY} barely glances at her, Darcy’s eyes.', ['DARCY']).sort()).toEqual(['AT', 'BARELY', 'EYES', 'GLANCES', 'HER', 'S']);
  });

  it('knows a trace along part of a hidden word', () => {
    expect(insideWord([3, 4, 5], [[1, 2, 3, 4, 5, 6]])).toBe(true);
    expect(insideWord([5, 4, 3], [[1, 2, 3, 4, 5, 6]])).toBe(true);
    expect(insideWord([3, 5], [[1, 2, 3, 4, 5, 6]])).toBe(false);
    expect(insideWord([13, 4], [[1, 2, 3, 4, 5, 6]])).toBe(false);
  });

  it('never lets another passage word be traced on a board', () => {
    for (const def of levels) {
      const loose = validateLevel(def).filter((e) => e.includes('from the passage'));
      expect(loose, def.id).toEqual([]);
    }
  });

  it('rejects a board where a passage word can be traced by chance', () => {
    // C A T S
    // D O G S   GOAT runs G-O-A-T across both hidden words.
    const def: LevelDef = {
      ...levels[0],
      rows: 2,
      cols: 4,
      grid: ['CATS', 'DOGS'],
      words: [
        { text: 'CATS', path: [0, 1, 2, 3] },
        { text: 'DOGS', path: [4, 5, 6, 7] },
      ],
      story: { ...levels[0].story, text: 'The {CATS} and {DOGS} met a sheep.' },
    };
    expect(validateLevel(def)).toEqual([]);
    const goat = { ...def, story: { ...def.story, text: 'The {CATS} and {DOGS} met a goat.' } };
    expect(validateLevel(goat)).toEqual(['GOAT, from the passage but not hidden, can be traced on the board']);
  });
});

describe('narration', () => {
  const narrations = import.meta.glob<{ audio: string; words: ([number, number] | null)[] }>('../src/narration/*.json', { eager: true, import: 'default' });

  it('times every word of its chapter’s passage, in order, with its recording beside it', () => {
    for (const [path, narration] of Object.entries(narrations)) {
      const id = path.split('/').pop()!.replace('.json', '');
      const def = levels.find((l) => l.id === id);
      expect(def, id).toBeDefined();
      const words = passageTokens(passageParts(def!.story.text, BOOKS[def!.book].names));
      expect(narration.words.length, id).toBe(words.length);
      let last = 0;
      for (const span of narration.words) {
        if (!span) continue;
        expect(span[0], id).toBeGreaterThanOrEqual(last - 0.001);
        expect(span[1], id).toBeGreaterThanOrEqual(span[0]);
        last = span[0];
      }
      expect(existsSync(new URL(`../public/${narration.audio}`, import.meta.url)), id).toBe(true);
    }
  });
});

describe('sentences', () => {
  it('end at a stop, but not at a title like Mr. or Mrs.', () => {
    expect(endsSentence('')).toBe(true);
    expect(endsSentence('She laughs. ')).toBe(true);
    expect(endsSentence('“Tempt me.” ')).toBe(true);
    expect(endsSentence('Then Mr. ')).toBe(false);
    expect(endsSentence('and Mrs. ')).toBe(false);
    expect(endsSentence('St. ')).toBe(false);
    expect(endsSentence('Mr. Bennet laughs, ')).toBe(false);
  });
});
