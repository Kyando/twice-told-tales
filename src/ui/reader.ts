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
  /** The chapter's recorded reading; without one, the reader is just the text, large. */
  narrator: Narrator | null;
}

/** Reading speeds to step through, for learners: normal, then slower. */
const RATES = [1, 0.85, 0.7];
/** After the reader scrolls by hand, the page stops following the voice for this long (ms). */
const HANDS_OFF_MS = 3000;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * The scene, full screen, to read on its own: one sentence per line, large. With narration it reads
 * along like sung lyrics: the line being read stands out, the others fade back, and within it each
 * word darkens as it's spoken, the one being said in the accent colour. The page keeps the line being
 * read in view. Tapping any word goes back (or ahead) to it; the controls pause, step a sentence
 * back or forward, and slow the voice down.
 */
export function openReader(o: ReaderOptions): void {
  const dom = buildPassage(o.parts, 'reader-line');
  dom.hidden.forEach((el, word) => el.classList.toggle('is-found', o.found.has(word)));
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
    const speed = h('button', { type: 'button', class: 'reader-speed', 'aria-label': t('reader.speed'), title: t('reader.speed') }, `${n.rate}×`);
    speed.addEventListener('click', () => {
      n.rate = RATES[(RATES.indexOf(n.rate) + 1) % RATES.length] ?? 1;
      speed.textContent = `${n.rate}×`;
    });
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
        h('div', { class: 'reader-buttons' }, speed, back, play, ahead, h('span', { class: 'reader-spacer' })),
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
