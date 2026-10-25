import type { PassagePart } from '../core/passage.ts';
import { t } from '../i18n/index.ts';
import { h, svg } from './dom.ts';
import { ICONS } from './icons.ts';
import type { Narrator } from './narrator.ts';
import { presentDialog } from './overlay.ts';
import { buildPassage } from './passage-dom.ts';

export interface ReaderOptions {
  eyebrow: string;
  title: string;
  parts: readonly PassagePart[];
  /** The hidden words found so far (upper case): marked as on the chapter's screen. */
  found: ReadonlySet<string>;
  /** The words to find are marked from the start (the word list's help), as on the chapter's screen. */
  marked?: boolean;
  /** The chapter's recorded reading; without one, the reader is just the text, large. */
  narrator: Narrator | null;
}

/** Reading speeds to pick from: YouTube's, slower ones for learners and faster ones for a reread. */
const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** After the reader scrolls by hand, the page stops following the voice for this long (ms). */
const HANDS_OFF_MS = 3000;

/** Dragged down this far (px) by its top, the sheet closes; less, and it springs back. */
const DRAG_CLOSE_PX = 90;

/**
 * On phones the reader is a sheet: dragging its top bar down pulls it with the finger, and letting
 * go far enough down closes it, as sheets do. (On wide screens it's a card; the drag works the same.)
 */
function dragToClose(dialog: HTMLDialogElement, handle: HTMLElement): void {
  let start: { id: number; y: number } | null = null;
  let dy = 0;
  handle.style.touchAction = 'none';
  handle.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return;
    start = { id: e.pointerId, y: e.clientY };
    dy = 0;
    handle.setPointerCapture(e.pointerId);
    dialog.style.transition = 'none';
  });
  handle.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    dy = Math.max(0, e.clientY - start.y);
    dialog.style.transform = `translateY(${dy}px)`;
  });
  const end = (e: PointerEvent) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    dialog.style.transition = 'transform 0.22s ease-out';
    if (dy > DRAG_CLOSE_PX) {
      dialog.style.transform = 'translateY(100%)';
      window.setTimeout(() => dialog.close(), 200);
    } else {
      dialog.style.transform = '';
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The scene in a panel over the game (dimmed behind it; tapping outside closes it), to read on its
 * own: one sentence per line, large. With narration it reads
 * along like sung lyrics: the line being read stands out, the others fade back, and within it each
 * word darkens as it's spoken, the one being said in the accent colour. The page keeps the line being
 * read in view. Tapping any word goes back (or ahead) to it; the controls pause, step a sentence
 * back or forward, and pick the voice's speed.
 */
export function openReader(o: ReaderOptions): void {
  const dom = buildPassage(o.parts, 'reader-line');
  dom.hidden.forEach((el, word) => {
    el.classList.toggle('is-found', o.found.has(word));
    if (o.marked) el.classList.add('is-target');
  });
  const text = h('div', { class: 'reader-text' }, ...dom.sentences);
  const scroller = h('div', { class: 'reader-scroll' }, text);
  const dialog = h('dialog', { class: 'reader', 'aria-label': o.title });
  const head = h(
    'header',
    { class: 'reader-head' },
    h('div', { class: 'reader-title' }, h('p', { class: 'eyebrow' }, o.eyebrow), h('h2', {}, o.title)),
    h('button', { type: 'button', class: 'icon-btn reader-close', 'aria-label': t('modal.close'), title: t('modal.close'), onclick: () => dialog.close() }, svg(ICONS.close)),
  );
  dialog.append(head, scroller);
  dragToClose(dialog, head);

  const n = o.narrator;
  let unfollow = () => {};
  if (n) {
    n.prepare();
    dialog.classList.add('has-voice');
    const { words, sentenceOf, sentences } = dom;
    const firstOf = (line: number) => sentenceOf.indexOf(line);

    // Tapping a word reads from there.
    words.forEach((el, i) => {
      if (!n.times[i]) return;
      el.addEventListener('click', () => {
        n.seekWord(i);
        n.play();
      });
    });

    const now = h('span', { class: 'reader-time' }, '0:00');
    const total = h('span', { class: 'reader-time' }, clock(n.duration));
    const bar = h('input', { type: 'range', class: 'reader-bar', min: '0', step: '0.01', value: '0', 'aria-label': t('reader.position') }) as HTMLInputElement;
    bar.max = String(n.duration);
    bar.addEventListener('input', () => n.seek(Number(bar.value)));
    // The speed: a button showing it, which opens the list of speeds to pick from (as on YouTube).
    const rateLabel = (rate: number) => (rate === 1 ? t('reader.normal') : `${rate}×`);
    const speed = h('button', { type: 'button', class: 'reader-speed', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: t('reader.speed') }, `${n.rate}×`);
    const rates = h('div', { class: 'reader-rates', role: 'menu', 'aria-label': t('reader.speed') });
    rates.hidden = true;
    const showRates = (open: boolean) => {
      rates.hidden = !open;
      speed.setAttribute('aria-expanded', String(open));
      if (open) (rates.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
    };
    const fillRates = () =>
      rates.replaceChildren(
        ...RATES.map((rate) =>
          h(
            'button',
            {
              type: 'button',
              role: 'menuitemradio',
              'aria-checked': String(rate === n.rate),
              class: 'reader-rate',
              onclick: () => {
                n.rate = rate;
                speed.textContent = `${rate}×`;
                fillRates();
                showRates(false);
                speed.focus();
              },
            },
            svg(ICONS.check),
            rateLabel(rate),
          ),
        ),
      );
    fillRates();
    speed.addEventListener('click', (e) => {
      e.stopPropagation();
      showRates(!!rates.hidden);
    });
    // Anywhere else closes the list; so does Escape, before it would close the reader.
    dialog.addEventListener('click', (e) => {
      if (!rates.hidden && !rates.contains(e.target as Node)) showRates(false);
    });
    dialog.addEventListener('cancel', (e) => {
      if (rates.hidden) return;
      e.preventDefault();
      showRates(false);
      speed.focus();
    });
    const speedBox = h('div', { class: 'reader-speed-box' }, speed, rates);
    const play = h('button', { type: 'button', class: 'reader-play' }, svg(ICONS.play));
    play.addEventListener('click', () => n.toggle());
    // A sentence back: to the start of this one, or, right at its start, to the one before.
    const lineNow = () => {
      let reached = 0;
      n.times.forEach((span, i) => {
        if (span && span[0] <= n.time + 0.01) reached = i;
      });
      return sentenceOf[reached] ?? 0;
    };
    const back = h('button', { type: 'button', class: 'icon-btn reader-step', 'aria-label': t('reader.back'), title: t('reader.back') }, svg(ICONS.prev));
    back.addEventListener('click', () => {
      const line = lineNow();
      const start = n.times[firstOf(line)]?.[0] ?? 0;
      n.seekWord(firstOf(n.time - start > 1 || line === 0 ? line : line - 1));
    });
    const ahead = h('button', { type: 'button', class: 'icon-btn reader-step', 'aria-label': t('reader.ahead'), title: t('reader.ahead') }, svg(ICONS.next));
    ahead.addEventListener('click', () => {
      const line = lineNow();
      if (line + 1 < sentences.length) n.seekWord(firstOf(line + 1));
    });
    dialog.append(
      h(
        'footer',
        { class: 'reader-controls' },
        h('div', { class: 'reader-track' }, now, bar, total),
        h('div', { class: 'reader-buttons' }, speedBox, back, play, ahead, h('span', { class: 'reader-spacer' })),
      ),
    );

    // Keeping the line being read in view, unless the reader is scrolling on their own.
    let handsOff = 0;
    const byHand = () => (handsOff = performance.now());
    ['wheel', 'touchmove', 'keydown'].forEach((type) => scroller.addEventListener(type, byHand, { passive: true }));
    const show = (line: number) => {
      if (performance.now() - handsOff < HANDS_OFF_MS) return;
      const el = sentences[line];
      scroller.scrollTo({ top: el.offsetTop - scroller.clientHeight * 0.3, behavior: 'smooth' });
    };

    let lit = -2;
    let current = -1;
    let reached = -1;
    unfollow = n.follow(({ word, time, playing }) => {
      dialog.classList.toggle('is-following', playing || time > 0);
      play.replaceChildren(svg(playing ? ICONS.pause : ICONS.play));
      const label = t(playing ? 'reader.pause' : 'reader.play');
      play.setAttribute('aria-label', label);
      play.title = label;
      now.textContent = clock(time);
      total.textContent = clock(n.duration);
      bar.max = String(n.duration);
      if (document.activeElement !== bar) bar.value = String(time);
      // The words already said, the one being said, and the line they're in.
      let upTo = -1;
      n.times.forEach((span, i) => {
        if (span && span[0] <= time && (playing || time > 0)) upTo = i;
      });
      if (upTo !== reached || word !== lit) {
        words.forEach((el, i) => {
          el.classList.toggle('is-read', i <= upTo && i !== word);
          el.classList.toggle('is-now', i === word);
        });
        reached = upTo;
        lit = word;
      }
      const line = upTo < 0 ? (playing ? 0 : -1) : sentenceOf[upTo];
      if (line !== current) {
        sentences[current]?.classList.remove('is-current');
        sentences[line]?.classList.add('is-current');
        current = line;
        if (line >= 0) show(line);
      }
    });
  }

  presentDialog(dialog, () => unfollow());
}
