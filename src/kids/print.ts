/**
 * The colouring book on paper: every page of the book, ready to print or save as a PDF.
 *   kids-book.html?lang=pt&size=letter&view=pages
 *
 * Each scene is one open spread: the story and its grid on the left, the picture to colour on the
 * right, so a child reads, searches and colours without turning. The book:
 *   title page · this book belongs to + how to play · meet the characters (a colouring page)
 *   6 × [story and grid | picture] · answers · draw yourself with the bears
 *
 * `view=spreads` prints two pages per sheet, side by side (A5 pages on A4 landscape: a proof, or a
 * booklet at home). `view=pages` prints one page per sheet at the book's trim size, inside margin
 * wider for the binding: the interior PDF for a print-on-demand service.
 */
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './print.css';
import { passageParts } from '../core/passage.ts';
import { cast, SCENES as DRAWINGS, swatches } from './scenes.ts';
import { BOOK, LANGS, SCENES, type Lang } from './story.ts';
import { say, type TextKey } from './text.ts';
import type { LevelDef } from '../core/types.ts';

type Board = Pick<LevelDef, 'rows' | 'cols' | 'grid' | 'words'>;
const BOARDS = import.meta.glob<Board>('./levels/*.json', { eager: true, import: 'default' });

/** Trim sizes (mm), and the sheet a spread of two prints on. */
const SIZES = {
  a5: { w: 148, h: 210, spreadSheet: 'A4 landscape', label: 'A5 (148 × 210 mm)' },
  letter: { w: 215.9, h: 279.4, spreadSheet: '431.8mm 279.4mm', label: 'US Letter (8.5 × 11 in)' },
} as const;
type Size = keyof typeof SIZES;
type View = 'spreads' | 'pages';

interface Options {
  lang: Lang;
  size: Size;
  view: View;
}

function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') === 'pt' ? 'pt' : 'en';
  const size = q.get('size') === 'letter' ? 'letter' : 'a5';
  const view = q.get('view') === 'pages' ? 'pages' : 'spreads';
  return { lang, size, view };
}

const URL_TEXT = 'kyando.github.io/twice-told-tales/kids.html';

// ── building blocks ───────────────────────────────────────────────────────

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', ...children: (Node | string | null)[]): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  for (const c of children) if (c !== null) el.append(c);
  return el;
};

let clipCount = 0;
/** A drawing, every part inked, its clip path given an id of its own (a book holds several). */
function art(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup;
  const svg = t.content.firstElementChild as SVGSVGElement;
  const clip = svg.querySelector('clipPath');
  if (clip) {
    const id = `${clip.id}-${++clipCount}`;
    svg.querySelector('[clip-path]')?.setAttribute('clip-path', `url(#${id})`);
    clip.id = id;
  }
  return svg;
}

/** One page of the book; its side and number come from where it falls. */
interface Page {
  cls: string;
  children: (Node | string | null)[];
  /** No printed page number: title, picture and blank pages. */
  bare?: boolean;
}
const page = (cls: string, ...children: (Node | string | null)[]): Page => ({ cls, children });
const barePage = (cls: string, ...children: (Node | string | null)[]): Page => ({ cls, children, bare: true });

/** The scene's story, its hidden words in boxes to colour in when found. */
function story(text: string): HTMLElement {
  const p = h('p', 'story');
  for (const part of passageParts(text, [])) p.append(part.word ? h('span', 'find', part.text) : part.text);
  return p;
}

/** The grid of letters; its cell size is set once the page is laid out (see fitGrids). */
function letters(board: Board): HTMLElement {
  const g = h('div', 'letters');
  g.style.setProperty('--cols', String(board.cols));
  g.style.setProperty('--rows', String(board.rows));
  for (const row of board.grid) for (const ch of row) g.append(h('span', ch === '.' ? 'cell is-hole' : 'cell', ch === '.' ? '' : ch));
  return g;
}

/** Tick boxes for the words, in the order the story reads them. */
function ticks(text: string): HTMLElement {
  const list = h('ul', 'ticks');
  for (const part of passageParts(text, [])) if (part.word) list.append(h('li', '', h('span', 'box'), part.text.toLowerCase()));
  return list;
}

/** Each word's path in its own soft colour, so words that touch stay apart. */
const ANSWER_HUES = ['#f6c94c', '#8fd19a', '#8cc8f5', '#f5a3bd', '#c3a6f2', '#f7b27a'];

/** A small solved grid: the letters, each word's path drawn over them. */
function answerGrid(board: Board, title: string, n: number): HTMLElement {
  const s = 10;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${board.cols * s} ${board.rows * s}`);
  svg.setAttribute('class', 'answer-svg');
  const centre = (cell: number) => [(cell % board.cols) * s + s / 2, Math.floor(cell / board.cols) * s + s / 2];
  board.words.forEach((w, i) => {
    const line = document.createElementNS(ns, 'polyline');
    line.style.stroke = ANSWER_HUES[i % ANSWER_HUES.length];
    line.setAttribute('points', w.path.map((c) => centre(c).join(',')).join(' '));
    line.setAttribute('class', 'answer-path');
    svg.append(line);
  });
  board.grid.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      const t = document.createElementNS(ns, 'text');
      t.setAttribute('x', String(c * s + s / 2));
      t.setAttribute('y', String(r * s + s / 2));
      t.textContent = ch === '.' ? '' : ch;
      svg.append(t);
    }),
  );
  return h('figure', 'answer', svg, h('figcaption', '', `${n}. ${title}`));
}

// ── the book ──────────────────────────────────────────────────────────────

function build(o: Options): Page[] {
  const t = (key: TextKey) => say(o.lang, key);
  const pages: Page[] = [];
  /** Starts on a left-hand page (an even index: page 0 is the inside of the cover). */
  const left = (...p: Page[]) => {
    if (pages.length % 2) pages.push(barePage('is-blank'));
    pages.push(...p);
  };
  const right = (...p: Page[]) => {
    if (pages.length % 2 === 0) pages.push(barePage('is-blank'));
    pages.push(...p);
  };

  right(
    barePage(
      'title-page',
      h('p', 'brand', t('app')),
      h('h1', '', BOOK.title[o.lang]),
      h('p', 'subtitle', t('subtitle')),
      h('div', 'title-art', art(cast())),
    ),
  );
  left(
    page(
      'how-page',
      h('div', 'belongs', h('p', '', t('belongs')), h('span', 'write-line')),
      h('h2', '', t('howTitle')),
      h('ol', 'how', h('li', '', t('how1')), h('li', '', t('how2')), h('li', '', t('how3'))),
      h('p', 'credit', BOOK.credit[o.lang]),
    ),
    barePage('picture-page', h('h2', 'picture-title', t('tryColours')), h('div', 'picture', art(swatches()))),
  );

  SCENES.forEach((scene, i) => {
    const text = scene[o.lang];
    const board = BOARDS[`./levels/${o.lang}-${i + 1}.json`];
    left(
      page(
        'scene-page',
        h('p', 'scene-no', String(i + 1)),
        h('h2', '', text.title),
        story(text.text),
        h('div', 'letters-wrap', letters(board)),
        ticks(text.text),
      ),
      barePage('picture-page', h('div', 'picture', art(DRAWINGS[scene.id]()))),
    );
  });

  left(
    page('answers-page', h('h2', '', t('answers')), h('div', 'answers', ...SCENES.map((s, i) => answerGrid(BOARDS[`./levels/${o.lang}-${i + 1}.json`], s[o.lang].title, i + 1)))),
    page(
      'end-page',
      h('p', 'the-end', t('theEnd')),
      h('p', 'draw-prompt', t('drawYou')),
      h('div', 'draw-frame'),
      h('p', 'online', `${t('readOnline')} ${URL_TEXT}`),
    ),
  );
  if (pages.length % 2) pages.push(barePage('is-blank'));
  return pages;
}

function render(o: Options): HTMLElement[] {
  const pages = build(o);
  const leaf = (p: Page, n: number) => {
    const side = n % 2 ? 'right' : 'left';
    return h('div', `leaf ${side} ${p.cls}`, ...p.children, p.bare ? null : h('span', 'folio', String(n)));
  };
  if (o.view === 'pages') {
    // From the first printed page (the title, page 1): the inside of the cover isn't printed.
    return pages.slice(1).map((p, i) => h('section', 'sheet single', leaf(p, i + 1)));
  }
  const sheets: HTMLElement[] = [];
  for (let i = 0; i < pages.length; i += 2) sheets.push(h('section', 'sheet', leaf(pages[i], i), leaf(pages[i + 1], i + 1)));
  return sheets;
}

/** Each grid as large as its page leaves room for, up to a comfortable size for small fingers. */
function fitGrids(root: HTMLElement, o: Options): void {
  const mm = 96 / 25.4;
  const most = o.size === 'letter' ? 24 : 17;
  root.querySelectorAll<HTMLElement>('.letters-wrap').forEach((wrap) => {
    const g = wrap.firstElementChild as HTMLElement;
    const cols = Number(g.style.getPropertyValue('--cols'));
    const rows = Number(g.style.getPropertyValue('--rows'));
    const gap = 1.6;
    const w = wrap.clientWidth / mm;
    const ht = wrap.clientHeight / mm;
    const cell = Math.max(8, Math.min(most, (w - gap * (cols - 1)) / cols, (ht - gap * (rows - 1)) / rows));
    g.style.setProperty('--cell', `${cell.toFixed(2)}mm`);
  });
}

// ── the screen around it ──────────────────────────────────────────────────

const root = document.getElementById('kids-print')!;
const sheetStyle = document.head.appendChild(document.createElement('style'));

function toolbar(o: Options, update: (o: Options) => void): HTMLElement {
  const choice = <T extends string>(label: string, value: T, options: [T, string][], set: (v: T) => Options) => {
    const select = h('select', '');
    for (const [v, text] of options) {
      const opt = h('option', '', text);
      opt.value = v;
      opt.selected = v === value;
      select.append(opt);
    }
    select.addEventListener('change', () => update(set(select.value as T)));
    return h('label', '', `${label} `, select);
  };
  const print = h('button', 'print-btn', 'Print / Save as PDF');
  print.addEventListener('click', () => window.print());
  return h(
    'header',
    'toolbar',
    h('strong', '', `${BOOK.title.en}: print edition`),
    choice('Language', o.lang, LANGS.map((l) => [l, say(l, 'langName')]), (lang) => ({ ...o, lang })),
    choice('Page size', o.size, (Object.keys(SIZES) as Size[]).map((s) => [s, SIZES[s].label]), (size) => ({ ...o, size })),
    choice('Layout', o.view, [['spreads', 'Spreads: two pages per sheet (proof, home printing)'], ['pages', 'Single pages at trim size (print-on-demand)']], (view) => ({ ...o, view })),
    print,
    h('p', 'toolbar-note', 'In the print dialog: margins None, scale 100%, background graphics on.'),
  );
}

function draw(o: Options): void {
  history.replaceState(null, '', `?lang=${o.lang}&size=${o.size}&view=${o.view}`);
  document.documentElement.lang = o.lang === 'pt' ? 'pt-BR' : 'en';
  document.title = `${BOOK.title[o.lang]} · print edition`;
  const size = SIZES[o.size];
  sheetStyle.textContent = `@page { size: ${o.view === 'pages' ? `${size.w}mm ${size.h}mm` : size.spreadSheet}; margin: 0; }
    :root { --pw: ${size.w}mm; --ph: ${size.h}mm; }`;
  root.className = `size-${o.size} view-${o.view}`;
  root.replaceChildren(toolbar(o, draw), ...render(o));
  void document.fonts.ready.then(() => fitGrids(root, o));
}

draw(readOptions());
