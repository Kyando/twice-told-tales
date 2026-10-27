/**
 * The colouring book, on screen: an open book whose left page tells the scene, its words to find
 * marked in colour above a small grid of letters, and whose right page is the scene's drawing.
 * Each word found inks in its part of the drawing; once inked, a part can be coloured in with a tap.
 */
import { adjacent } from '../core/grid.ts';
import { passageParts } from '../core/passage.ts';
import { buildPuzzle, matchTrace, type Puzzle } from '../core/puzzle.ts';
import { steer } from '../core/steer.ts';
import type { LevelDef, WordDef } from '../core/types.ts';
import { burst } from '../ui/fx.ts';
import { Sfx } from '../ui/sfx.ts';
import { SCENES as DRAWINGS } from './scenes.ts';
import { BOOK, LANGS, SCENES, type Lang, type Scene } from './story.ts';
import { say, SPEECH_LANG, type TextKey } from './text.ts';

// ── boards and saved progress ─────────────────────────────────────────────

type Board = Pick<LevelDef, 'rows' | 'cols' | 'grid' | 'words'>;
const BOARDS = import.meta.glob<Board>('./levels/*.json', { eager: true, import: 'default' });

function puzzleFor(scene: Scene, lang: Lang): Puzzle {
  const n = SCENES.indexOf(scene) + 1;
  const board = BOARDS[`./levels/${lang}-${n}.json`];
  const text = scene[lang];
  return buildPuzzle({ id: `${lang}-${n}-${scene.id}`, book: BOOK.id, chapter: n, title: text.title, ...board, story: { text: text.text, image: '', caption: '', credit: '' } });
}

interface ScenePlay {
  /** Words found, per language (each language has its own grid). */
  found: Partial<Record<Lang, string[]>>;
  /** Every word found, in either language: the whole drawing is inked. */
  done?: boolean;
  /** Colours, by region number (the order of the drawing's regions). */
  fills: Record<string, string>;
}

interface KidsSave {
  lang: Lang;
  scenes: Record<string, ScenePlay>;
}

const SAVE_KEY = 'ttt-kids-v1';

function loadSave(): KidsSave {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as KidsSave | null;
    if (raw && LANGS.includes(raw.lang) && raw.scenes) return raw;
  } catch {
    // A fresh book.
  }
  const nav = (navigator.language || 'en').toLowerCase();
  return { lang: nav.startsWith('pt') ? 'pt' : 'en', scenes: {} };
}

// ── colours ───────────────────────────────────────────────────────────────

/** Crayons, in the order of a box: warm to cool, then the browns and greys. */
export const CRAYONS = [
  '#f26b6b', '#f7a35c', '#fbd65a', '#fff3b0', '#b5de7a', '#5fbf73', '#8fd3f4', '#5b8fe0',
  '#b593e6', '#f7a8cc', '#c58b5c', '#ecc9a0', '#a9a6a2', '#4a4340',
];
export const ERASER = '#ffffff';

/** Each hidden word's highlight, in the order the scene reads them: the same in the text and on the grid. */
const WORD_HUES = ['#ffd75e', '#9be0a5', '#9fd4ff', '#ffb3c7', '#d4b8ff', '#ffc38a'];

// ── the app ───────────────────────────────────────────────────────────────

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.append(...children);
  return el;
};

function button(cls: string, label: string, content: Node | string, onClick: () => void): HTMLButtonElement {
  const b = h('button', cls, content);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

const ICON = {
  home: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7M6 10v9h12v-9"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  speak: '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z"/></svg>',
  eraser: '<svg viewBox="0 0 24 24"><path d="m14 4 6 6-9 9H6l-3-3 11-12zM9 9l6 6M11 19h9"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
};
const icon = (markup: string): SVGElement => {
  const t = document.createElement('template');
  t.innerHTML = markup;
  return t.content.firstElementChild as SVGElement;
};

export class KidsApp {
  private save = loadSave();
  private readonly sfx = new Sfx(true);
  private view: { destroy(): void } | null = null;

  private readonly root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    const at = Number(new URLSearchParams(location.search).get('page'));
    const lang = new URLSearchParams(location.search).get('lang');
    if (lang === 'en' || lang === 'pt') this.save.lang = lang;
    if (at >= 1 && at <= SCENES.length) this.openScene(at - 1);
    else this.openCover();
  }

  get lang(): Lang {
    return this.save.lang;
  }

  private t(key: TextKey, vars?: Record<string, string | number>): string {
    return say(this.lang, key, vars);
  }

  play(scene: Scene): ScenePlay {
    return (this.save.scenes[scene.id] ??= { found: {}, fills: {} });
  }

  persist(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      // Private mode: the book forgets when closed.
    }
  }

  private setLang(lang: Lang, again: () => void): void {
    if (lang === this.lang) return;
    speechSynthesis?.cancel();
    this.save.lang = lang;
    this.persist();
    again();
  }

  private langSwitch(again: () => void): HTMLElement {
    const box = h('div', 'k-lang');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', this.t('language'));
    for (const lang of LANGS) {
      const b = button(`k-lang-btn${lang === this.lang ? ' is-on' : ''}`, say(lang, 'langName'), lang.toUpperCase(), () => this.setLang(lang, again));
      b.setAttribute('aria-pressed', String(lang === this.lang));
      box.append(b);
    }
    return box;
  }

  private show(el: HTMLElement, view: { destroy(): void } = { destroy() {} }): void {
    this.view?.destroy();
    this.view = view;
    this.root.replaceChildren(el);
    document.documentElement.lang = this.lang === 'pt' ? 'pt-BR' : 'en';
    document.title = `${BOOK.title[this.lang]} · ${this.t('app')}`;
    window.scrollTo(0, 0);
  }

  // ── the cover: the book's pages, as small pictures ─────────────────────

  openCover(): void {
    history.replaceState(null, '', location.pathname);
    const next = SCENES.findIndex((s) => !this.play(s).done);
    const started = SCENES.some((s) => (this.play(s).found[this.lang]?.length ?? 0) > 0 || this.play(s).done);
    const pages = h('ol', 'k-pages');
    SCENES.forEach((scene, i) => {
      const thumb = drawing(scene, this.play(scene), new Set(), true);
      const card = button('k-page-card', `${this.t('pageOf', { n: i + 1, count: SCENES.length })}: ${scene[this.lang].title}`, '', () => this.openScene(i));
      card.append(h('span', 'k-thumb', thumb), h('span', 'k-page-num', String(i + 1)), h('span', 'k-page-title', scene[this.lang].title));
      if (this.play(scene).done) card.classList.add('is-done');
      pages.append(h('li', '', card));
    });
    const cover = drawing(SCENES[0], this.play(SCENES[0]), new Set(), true);
    const go = button('k-btn k-btn--big', this.t(started ? 'keepGoing' : 'start'), this.t(started ? 'keepGoing' : 'start'), () => this.openScene(Math.max(0, next)));
    const el = h(
      'main',
      'k-cover',
      h('header', 'k-cover-bar', h('span', 'k-brand', this.t('app')), this.langSwitch(() => this.openCover())),
      h('section', 'k-cover-book', h('div', 'k-cover-art', cover), h('div', 'k-cover-text', h('h1', 'k-cover-title', BOOK.title[this.lang]), h('p', 'k-cover-credit', BOOK.credit[this.lang]), go)),
      h('h2', 'k-pages-title', this.t('pages')),
      pages,
    );
    this.show(el);
  }

  // ── a scene: the open book ─────────────────────────────────────────────

  openScene(index: number): void {
    history.replaceState(null, '', `?page=${index + 1}`);
    const view = new SceneView(this, SCENES[index], index, {
      home: () => this.openCover(),
      go: (to) => this.openScene(to),
      lang: (again) => this.langSwitch(again),
    });
    this.show(view.el, view);
  }

  get sound(): Sfx {
    return this.sfx;
  }
}

/** The scene's drawing, with what's found so far inked in and its colours put back. */
function drawing(scene: Scene, play: ScenePlay, inked: Set<string>, thumb = false): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = DRAWINGS[scene.id]();
  const svg = t.content.firstElementChild as SVGSVGElement;
  if (thumb) {
    svg.classList.add('is-thumb');
    // Clip paths must be unique on a page holding many drawings.
    const clip = svg.querySelector('clipPath');
    const id = `${clip?.id}-t${Math.random().toString(36).slice(2, 7)}`;
    svg.querySelector('[clip-path]')?.setAttribute('clip-path', `url(#${id})`);
    if (clip) clip.id = id;
  }
  svg.querySelectorAll<SVGGElement>('.part').forEach((g) => {
    if (play.done || inked.has(g.dataset.k ?? '')) g.classList.add('is-inked');
  });
  regionsOf(svg).forEach((r, i) => {
    const fill = play.fills[i];
    if (fill) r.style.fill = fill;
  });
  return svg;
}

const regionsOf = (svg: SVGSVGElement): SVGElement[] => [...svg.querySelectorAll<SVGElement>('.r')];

interface SceneNav {
  home(): void;
  go(index: number): void;
  lang(again: () => void): HTMLElement;
}

class SceneView {
  readonly el: HTMLElement;
  private readonly puzzle: Puzzle;
  private readonly lang: Lang;
  private readonly play: ScenePlay;
  private readonly found: Set<number>;
  private readonly tiles: HTMLElement[] = [];
  private readonly marks = new Map<string, HTMLElement[]>();
  private readonly board: HTMLElement;
  private readonly status: HTMLElement;
  private readonly svg: SVGSVGElement;
  private readonly leafRight: HTMLElement;
  private readonly words: HTMLElement[] = [];
  private trace: number[] = [];
  private gesture: { u: number; v: number; dir: number; moved: boolean } | null = null;
  private crayon = CRAYONS[0];
  private readonly palette: HTMLElement;

  private readonly app: KidsApp;
  private readonly scene: Scene;
  private readonly index: number;
  private readonly nav: SceneNav;

  constructor(app: KidsApp, scene: Scene, index: number, nav: SceneNav) {
    this.app = app;
    this.scene = scene;
    this.index = index;
    this.nav = nav;
    this.lang = app.lang;
    this.play = app.play(scene);
    this.puzzle = puzzleFor(scene, this.lang);
    const text = scene[this.lang];
    const t = (key: TextKey, vars?: Record<string, string | number>) => say(this.lang, key, vars);
    const foundWords = new Set(this.play.found[this.lang] ?? []);
    this.found = new Set(this.puzzle.words.filter((w) => foundWords.has(w.text)).map((w) => w.index));

    // The left page: the scene, with its words to find in colour, and the grid.
    const parts = passageParts(text.text, []);
    const hue = new Map<string, string>();
    parts.forEach((p) => p.word && !hue.has(p.word) && hue.set(p.word, WORD_HUES[hue.size % WORD_HUES.length]));
    const passage = h('p', 'k-text');
    for (const p of parts) {
      if (!p.word) {
        // Plain words as spans too, so the reading voice can light them.
        for (const piece of p.text.split(/(\s+)/)) {
          if (!piece) continue;
          if (/^\s+$/.test(piece)) passage.append(piece);
          else {
            const w = h('span', 'k-w', piece);
            this.words.push(w);
            passage.append(w);
          }
        }
        continue;
      }
      const mark = h('mark', 'k-w k-find', p.text);
      mark.style.setProperty('--hue', hue.get(p.word)!);
      this.marks.set(p.word, [...(this.marks.get(p.word) ?? []), mark]);
      this.words.push(mark);
      passage.append(mark);
    }

    this.board = h('div', 'k-board');
    this.board.style.setProperty('--cols', String(this.puzzle.cols));
    this.board.style.setProperty('--rows', String(this.puzzle.rows));
    [...this.puzzle.letters].forEach((letter, cell) => {
      const tile = h('span', 'k-tile', letter);
      tile.dataset.cell = String(cell);
      this.tiles.push(tile);
      this.board.append(tile);
    });
    this.wordHue = (w) => hue.get(w) ?? WORD_HUES[0];
    this.status = h('p', 'k-status');
    this.status.setAttribute('aria-live', 'polite');

    const reading = this.readButton(text.text, parts.map((p) => p.text).join(''));
    const left = h(
      'section',
      'k-leaf k-leaf--left',
      h('p', 'k-eyebrow', t('pageOf', { n: this.index + 1, count: SCENES.length })),
      h('h1', 'k-title', text.title),
      passage,
      reading,
      this.board,
      this.status,
      h('span', 'k-folio', String(this.index * 2 + 1)),
    );

    // The right page: the drawing, and the crayons once there's something to colour.
    this.svg = drawing(scene, this.play, this.inkedKeys());
    this.svg.addEventListener('click', (e) => this.colourAt(e));
    this.palette = this.makePalette();
    const pages = h('nav', 'k-turns');
    if (this.index > 0) pages.append(button('k-round', t('prev'), icon(ICON.prev), () => this.nav.go(this.index - 1)));
    pages.append(h('span', 'k-turns-gap'));
    if (this.index < SCENES.length - 1) pages.append(button('k-round k-round--next', t('next'), icon(ICON.next), () => this.nav.go(this.index + 1)));
    else pages.append(h('span', 'k-the-end', t('theEnd')));
    this.leafRight = h('section', 'k-leaf k-leaf--right', h('div', 'k-art', this.svg), this.palette, pages, h('span', 'k-folio', String(this.index * 2 + 2)));

    const bar = h(
      'header',
      'k-bar',
      button('k-round', t('home'), icon(ICON.home), () => this.nav.home()),
      h('span', 'k-bar-title', BOOK.title[this.lang]),
      button('k-round', t('print'), icon(ICON.print), () => window.print()),
      this.nav.lang(() => this.nav.go(this.index)),
    );
    this.el = h('main', 'k-scene', bar, h('div', 'k-spread', left, this.leafRight));
    this.bindBoard();
    this.render();
  }

  private readonly wordHue: (word: string) => string;
  private speaking = false;

  destroy(): void {
    if (this.speaking) speechSynthesis.cancel();
  }

  private get done(): boolean {
    return this.found.size === this.puzzle.words.length;
  }

  /** The parts of the drawing the words found so far have inked. */
  private inkedKeys(): Set<string> {
    const ink = this.scene[this.lang].ink;
    const keys = new Set<string>();
    for (const i of this.found) for (const k of ink[this.puzzle.words[i].text] ?? []) keys.add(k);
    return keys;
  }

  private render(): void {
    const owner = new Map<number, WordDef>();
    for (const i of this.found) for (const c of this.puzzle.words[i].path) owner.set(c, this.puzzle.words[i]);
    this.tiles.forEach((tile, cell) => {
      const w = owner.get(cell);
      tile.classList.toggle('is-found', !!w);
      tile.style.setProperty('--hue', w ? this.wordHue(w.text) : '');
      tile.classList.toggle('is-trace', this.trace.includes(cell));
    });
    for (const w of this.puzzle.words) for (const m of this.marks.get(w.text) ?? []) m.classList.toggle('is-found', this.found.has(w.index));
    const count = this.puzzle.words.length;
    const t = (key: TextKey, vars?: Record<string, string | number>) => say(this.lang, key, vars);
    this.status.textContent = this.done ? t('foundAll') : this.found.size ? t('foundSome', { found: this.found.size, count }) : t('find');
    this.el?.classList.toggle('is-done', this.done || !!this.play.done);
    this.palette.hidden = !this.svg.querySelector('.part.is-inked');
  }

  // ── reading aloud ──────────────────────────────────────────────────────

  private readButton(_marked: string, plain: string): HTMLElement {
    const b = button('k-read', say(this.lang, 'read'), '', () => this.toggleReading(plain, b));
    b.append(icon(ICON.speak), h('span', '', say(this.lang, 'read')));
    if (!('speechSynthesis' in window)) b.hidden = true;
    return b;
  }

  private toggleReading(plain: string, b: HTMLButtonElement): void {
    if (this.speaking) {
      speechSynthesis.cancel();
      return;
    }
    // Where each shown word starts in the spoken text, to light it as it's read.
    const starts: number[] = [];
    let from = 0;
    for (const w of this.words) {
      const at = plain.indexOf(w.textContent ?? '', from);
      starts.push(at);
      if (at >= 0) from = at + (w.textContent?.length ?? 0);
    }
    const u = new SpeechSynthesisUtterance(plain);
    u.lang = SPEECH_LANG[this.lang];
    u.rate = 0.85;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.replace('_', '-').startsWith(u.lang)) ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith(this.lang));
    if (voice) u.voice = voice;
    let lit: HTMLElement | null = null;
    const light = (el: HTMLElement | null) => {
      lit?.classList.remove('is-spoken');
      el?.classList.add('is-spoken');
      lit = el;
    };
    u.onboundary = (e) => {
      if (e.name !== 'word') return;
      let at = -1;
      starts.forEach((s, i) => s >= 0 && s <= e.charIndex && (at = i));
      light(this.words[at] ?? null);
    };
    const end = () => {
      this.speaking = false;
      light(null);
      b.classList.remove('is-on');
      b.querySelector('span')!.textContent = say(this.lang, 'read');
    };
    u.onend = end;
    u.onerror = end;
    this.speaking = true;
    b.classList.add('is-on');
    b.querySelector('span')!.textContent = say(this.lang, 'stop');
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  // ── tracing words ──────────────────────────────────────────────────────

  private toCells(x: number, y: number): { u: number; v: number } {
    const rect = this.board.getBoundingClientRect();
    const first = this.tiles[0];
    const size = first.offsetWidth;
    const step = this.puzzle.cols > 1 ? this.tiles[1].offsetLeft - first.offsetLeft : size;
    return { u: (x - rect.left - first.offsetLeft - size / 2) / step, v: (y - rect.top - first.offsetTop - size / 2) / step };
  }

  private cellAt(x: number, y: number): number {
    const { u, v } = this.toCells(x, y);
    const c = Math.round(u);
    const r = Math.round(v);
    return r < 0 || c < 0 || r >= this.puzzle.rows || c >= this.puzzle.cols ? -1 : r * this.puzzle.cols + c;
  }

  private free(cell: number): boolean {
    if (cell < 0) return false;
    return ![...this.found].some((i) => this.puzzle.words[i].path.includes(cell));
  }

  private bindBoard(): void {
    const b = this.board;
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.done) return;
      const cell = this.cellAt(e.clientX, e.clientY);
      if (!this.free(cell)) return;
      e.preventDefault();
      try {
        b.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointers can't be captured.
      }
      const end = this.trace[this.trace.length - 1];
      // A tap next to the trace's end carries it on; anywhere else starts afresh.
      if (this.trace.length && end !== cell && adjacent(end, cell, this.puzzle.cols) && !this.trace.includes(cell)) this.setTrace([...this.trace, cell]);
      else if (end !== cell) this.setTrace([cell]);
      this.gesture = { ...this.toCells(e.clientX, e.clientY), dir: 0, moved: false };
    });
    b.addEventListener('pointermove', (e) => {
      const g = this.gesture;
      if (!g) return;
      const { u, v } = this.toCells(e.clientX, e.clientY);
      const n = Math.max(1, Math.ceil(Math.hypot(u - g.u, v - g.v) / 0.2));
      let state = { trace: this.trace, dir: g.dir };
      for (let i = 1; i <= n; i++) state = steer(state, g.u + ((u - g.u) * i) / n, g.v + ((v - g.v) * i) / n, this.puzzle.rows, this.puzzle.cols, (c) => this.free(c));
      g.u = u;
      g.v = v;
      g.dir = state.dir;
      if (state.trace !== this.trace) {
        g.moved = true;
        this.setTrace(state.trace);
      }
    });
    const finish = () => {
      const g = this.gesture;
      this.gesture = null;
      if (!g) return;
      if (matchTrace(this.puzzle, this.trace) >= 0) this.submit();
      else if (g.moved && this.trace.length > 1) this.miss();
    };
    b.addEventListener('pointerup', finish);
    b.addEventListener('pointercancel', () => {
      this.gesture = null;
      this.setTrace([]);
    });
  }

  private setTrace(next: number[]): void {
    if (next.length > this.trace.length) this.app.sound.tick(next.length);
    this.trace = next;
    this.render();
  }

  private miss(): void {
    this.app.sound.nope();
    const cells = this.trace;
    this.trace = [];
    for (const c of cells) this.tiles[c].animate([{ translate: '0' }, { translate: '-4px' }, { translate: '4px' }, { translate: '0' }], { duration: 260 });
    this.render();
  }

  private submit(): void {
    const index = matchTrace(this.puzzle, this.trace);
    this.trace = [];
    if (index < 0 || this.found.has(index)) return this.render();
    const word = this.puzzle.words[index];
    this.found.add(index);
    this.play.found[this.lang] = this.puzzle.words.filter((w) => this.found.has(w.index)).map((w) => w.text);
    this.app.sound.piece(word.text.length, 60);
    // Its marks in the text pop, and its things in the drawing are inked in, one stroke after another.
    for (const m of this.marks.get(word.text) ?? []) m.animate([{ scale: '1' }, { scale: '1.18' }, { scale: '1' }], { duration: 420, easing: 'ease-out' });
    const keys = this.scene[this.lang].ink[word.text] ?? [];
    this.inkParts([...this.svg.querySelectorAll<SVGGElement>('.part')].filter((g) => keys.includes(g.dataset.k ?? '')));
    if (this.done) {
      this.play.done = true;
      window.setTimeout(() => {
        this.inkParts([...this.svg.querySelectorAll<SVGGElement>('.part:not(.is-inked)')]);
        this.app.sound.win();
        const r = this.svg.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 3, ['★', '♥', '✿', '●'], 26);
        if (matchMedia('(max-width: 759px)').matches) this.leafRight.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 700);
    }
    this.app.persist();
    this.render();
  }

  private inkParts(groups: SVGGElement[]): void {
    let delay = 0;
    for (const g of groups) {
      if (g.classList.contains('is-inked')) continue;
      g.style.setProperty('--delay', `${delay}ms`);
      g.classList.add('is-inked', 'is-inking');
      window.setTimeout(() => g.classList.remove('is-inking'), delay + 900);
      delay += 140;
    }
    this.render();
  }

  // ── colouring in ───────────────────────────────────────────────────────

  private makePalette(): HTMLElement {
    const box = h('div', 'k-palette');
    box.setAttribute('role', 'radiogroup');
    const pick = (b: HTMLElement, colour: string) => {
      this.crayon = colour;
      box.querySelectorAll('.is-on').forEach((x) => x.classList.remove('is-on'));
      b.classList.add('is-on');
      this.app.sound.pick();
    };
    CRAYONS.forEach((colour, i) => {
      const b = button(`k-crayon${i === 0 ? ' is-on' : ''}`, colour, '', () => pick(b, colour));
      b.style.setProperty('--c', colour);
      box.append(b);
    });
    const eraser = button('k-crayon k-crayon--eraser', say(this.lang, 'eraser'), icon(ICON.eraser), () => pick(eraser, ERASER));
    box.append(eraser);
    box.append(h('p', 'k-palette-hint', say(this.lang, 'colourIn')));
    return box;
  }

  private colourAt(e: MouseEvent): void {
    const target = (e.target as Element).closest('.r') as SVGElement | null;
    if (!target) return;
    const part = target.closest('.part');
    if (part && !part.classList.contains('is-inked')) return;
    const i = regionsOf(this.svg).indexOf(target);
    if (i < 0) return;
    if (this.crayon === ERASER) {
      target.style.fill = '';
      delete this.play.fills[i];
    } else {
      target.style.fill = this.crayon;
      this.play.fills[i] = this.crayon;
    }
    target.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 220 });
    this.app.sound.land();
    this.app.persist();
  }
}
