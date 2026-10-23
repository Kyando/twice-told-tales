import type { Book } from '../core/books.ts';
import { BOOKS } from '../core/books.ts';
import { passageParts } from '../core/passage.ts';
import type { LevelDef } from '../core/types.ts';
import { t, tn } from '../i18n/index.ts';
import { narrationFor, type Accent } from '../narration/index.ts';
import { roman } from './desk.ts';
import { h, svg } from './dom.ts';
import { ICONS } from './icons.ts';
import { lightSpokenWord, Narrator } from './narrator.ts';
import { presentDialog } from './overlay.ts';
import { buildPassage } from './passage-dom.ts';
import { loadPicture } from './picture.ts';

export interface EditionOptions {
  book: Book;
  /** The chapters pieced together so far, in reading order; `sealed` ones were found without a hint. */
  chapters: { def: LevelDef; sealed: boolean }[];
  /** How many chapters the book has in all. */
  total: number;
  /** The chapter to piece together next, when the book isn't finished. */
  next?: LevelDef;
  /** Opened by finishing the book: it starts with a word about that. */
  finale?: boolean;
  accent: Accent;
}

/** A pause between one chapter's reading and the next (ms). */
const BETWEEN_MS = 1100;
/** After the reader scrolls by hand, the page stops following the voice for this long (ms). */
const HANDS_OFF_MS = 3000;

/**
 * The player's own illustrated edition of a book: every chapter they've pieced together, in order,
 * each with its picture and its scene, as one book to read through. With narration it reads the whole
 * thing aloud, chapter after chapter, the page following the voice; tapping a word reads from there.
 * It grows as the player plays, and ends on The End once the last chapter is in.
 */
export function openEdition(o: EditionOptions): void {
  const { book, chapters } = o;
  const dialog = h('dialog', { class: 'reader edition', 'aria-label': t('edition.title', { book: book.title }) });
  const head = h(
    'header',
    { class: 'reader-head' },
    h('div', { class: 'reader-title' }, h('p', { class: 'eyebrow' }, t('edition.label')), h('h2', {}, book.title)),
    h('button', { type: 'button', class: 'icon-btn reader-close', 'aria-label': t('modal.close'), title: t('modal.close'), onclick: () => dialog.close() }, svg(ICONS.close)),
  );

  const artists = [...new Set(chapters.map((c) => c.def.story.credit.replace(/,.*$/, '')))];
  const done = chapters.length === o.total;
  const titlePage = h(
    'section',
    { class: 'edition-titlepage' },
    o.finale && done ? h('p', { class: 'edition-finale' }, t('edition.finale')) : '',
    h('h1', {}, book.title),
    h('p', { class: 'edition-by' }, t('edition.by', { author: book.author, year: book.year })),
    artists.length ? h('p', { class: 'edition-artists' }, t('edition.pictures', { artists: artists.join(', ') })) : '',
    h('p', { class: 'edition-count' }, tn('edition.count', o.total, { done: chapters.length })),
  );

  // Each chapter: its heading, its picture (trimmed, fetched as it comes into view), its scene.
  const narrators: (Narrator | null)[] = [];
  const words: HTMLElement[][] = [];
  const sections = chapters.map(({ def, sealed }, i) => {
    const dom = buildPassage(passageParts(def.story.text, BOOKS[def.book].names), 'edition-sentence');
    dom.hidden.forEach((mark) => mark.classList.add('is-found'));
    words.push(dom.words);
    const narration = narrationFor(def.id, o.accent);
    narrators.push(narration && narration.words.length === dom.words.length ? new Narrator(narration) : null);
    const img = h('img', { alt: def.story.caption, decoding: 'async' });
    img.dataset.chapter = String(i);
    return h(
      'section',
      { class: 'edition-chapter' },
      h(
        'header',
        { class: 'edition-chapter-head' },
        h('p', { class: 'eyebrow' }, t('desk.chapter', { n: roman(def.chapter) }), sealed ? h('span', { class: 'seal seal--inline', title: t('seal.label') }, svg(ICONS.seal)) : ''),
        h('h3', {}, def.title),
      ),
      h('figure', { class: 'edition-plate' }, img, h('figcaption', {}, def.story.caption, h('small', {}, def.story.credit))),
      h('p', { class: 'edition-text' }, ...dom.sentences),
    );
  });

  const left = o.total - chapters.length;
  const end = done
    ? h('p', { class: 'edition-end' }, t('edition.theEnd'))
    : o.next
      ? h('p', { class: 'edition-more' }, tn('edition.toCome', left, { title: o.next.title }))
      : '';
  const scroller = h('div', { class: 'reader-scroll edition-scroll' }, h('div', { class: 'edition-book' }, titlePage, ...sections, end));
  dialog.append(head, scroller);

  // Pictures load as they come near: a whole book of them at once would be a lot to fetch.
  const pictures = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target as HTMLImageElement;
        pictures.unobserve(img);
        const story = chapters[Number(img.dataset.chapter)].def.story;
        loadPicture(story.image, story.crop, 960, story.colour)
          .then((blob) => (img.src = URL.createObjectURL(blob)))
          .catch(() => (img.src = story.image));
      }
    },
    { root: scroller, rootMargin: '600px 0px' },
  );
  sections.forEach((s) => pictures.observe(s.querySelector('img')!));

  // ── reading aloud, chapter after chapter ──
  const voiced = narrators.some(Boolean);
  let current = -1;
  let stop = () => {};
  let handsOff = 0;
  const byHand = () => (handsOff = performance.now());
  ['wheel', 'touchmove', 'keydown'].forEach((type) => scroller.addEventListener(type, byHand, { passive: true }));

  const play = h('button', { type: 'button', class: 'reader-play' }, svg(ICONS.play));
  const now = h('span', { class: 'edition-now' });
  const step = (dir: -1 | 1) => {
    const from = current < 0 ? inView() : current;
    for (let i = from + dir; i >= 0 && i < narrators.length; i += dir) {
      if (narrators[i]) return readFrom(i, true);
    }
  };
  const prev = h('button', { type: 'button', class: 'icon-btn reader-step', 'aria-label': t('edition.prev'), title: t('edition.prev'), onclick: () => step(-1) }, svg(ICONS.prev));
  const next = h('button', { type: 'button', class: 'icon-btn reader-step', 'aria-label': t('edition.next'), title: t('edition.next'), onclick: () => step(1) }, svg(ICONS.next));

  /** The chapter at the top of the view: where reading starts when nothing has been read yet. */
  function inView(): number {
    const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.3;
    let at = 0;
    sections.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= top) at = i;
    });
    return at;
  }

  const showPlaying = (playing: boolean) => {
    play.replaceChildren(svg(playing ? ICONS.pause : ICONS.play));
    const label = t(playing ? 'edition.pause' : 'edition.play');
    play.setAttribute('aria-label', label);
    play.title = label;
    dialog.classList.toggle('is-following', playing);
  };

  /** Starts reading chapter `i` (from its start, or from where it was); `scroll` brings its heading into view first. */
  function readFrom(i: number, scroll: boolean, word = -1): void {
    const n = narrators[i];
    if (!n) return;
    if (current !== i) {
      if (current >= 0) narrators[current]?.pause();
      stop();
      current = i;
      sections.forEach((s, k) => s.classList.toggle('is-current', k === i));
      const def = chapters[i].def;
      now.textContent = t('edition.now', { n: roman(def.chapter), title: def.title });
      const unlight = lightSpokenWord(n, words[i]);
      let shown = -1;
      const unfollow = n.follow(({ word: w, playing }) => {
        showPlaying(playing);
        if (!playing || w < 0 || w === shown) return;
        shown = w;
        // The page keeps the word being read in view, unless the reader is scrolling on their own.
        if (performance.now() - handsOff < HANDS_OFF_MS) return;
        const el = words[i][w];
        const box = scroller.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        if (r.top < box.top + box.height * 0.2 || r.bottom > box.top + box.height * 0.75) {
          scroller.scrollTo({ top: scroller.scrollTop + r.top - box.top - box.height * 0.35, behavior: 'smooth' });
        }
      });
      // At the end of a chapter, a breath, then the next one with a voice.
      const unend = n.onEnded(() => {
        const after = narrators.findIndex((m, k) => k > i && m);
        if (after < 0) return;
        window.setTimeout(() => {
          if (current === i && !n.playing) readFrom(after, true);
        }, BETWEEN_MS);
      });
      stop = () => {
        unlight();
        unfollow();
        unend();
      };
      if (scroll) sections[i].scrollIntoView({ block: 'start', behavior: 'smooth' });
      n.seek(0);
    }
    if (word >= 0) n.seekWord(word);
    n.play();
  }

  if (voiced) {
    play.addEventListener('click', () => {
      const n = current >= 0 ? narrators[current] : null;
      if (n?.playing) n.pause();
      else if (n) n.play();
      else {
        const start = narrators.findIndex((m, k) => k >= inView() && m);
        readFrom(start < 0 ? narrators.findIndex(Boolean) : start, false);
      }
    });
    // Tapping a word reads from there, in whichever chapter it is.
    words.forEach((list, i) =>
      list.forEach((el, w) => {
        if (!narrators[i]?.times[w]) return;
        el.addEventListener('click', () => readFrom(i, false, w));
      }),
    );
    dialog.classList.add('has-voice');
    showPlaying(false);
    dialog.append(h('footer', { class: 'reader-controls edition-controls' }, h('div', { class: 'reader-buttons' }, prev, play, next), now));
  }

  presentDialog(dialog, () => {
    stop();
    pictures.disconnect();
    narrators.forEach((n) => n?.destroy());
  });
}
