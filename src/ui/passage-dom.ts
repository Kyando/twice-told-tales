import { SPOKEN_WORD, type PassagePart } from '../core/passage.ts';
import { h } from './dom.ts';

export interface PassageDom {
  /** The sentences, in order, each holding its text: what goes in the page. */
  sentences: HTMLElement[];
  /** Every spoken word's element, in passageTokens' order (so narration timings index into it). */
  words: HTMLElement[];
  /** For each word, the sentence it's in. */
  sentenceOf: number[];
  /** The hidden words' elements, by their text (upper case, as on the board). */
  hidden: Map<string, HTMLElement>;
}

/** A sentence ends at its stop, with any closing quote, and the space after it. */
const SENTENCE_END = /[.!?][”"’)]*\s+$/;

/**
 * Lays a passage out as elements: one per spoken word (the hidden words get `passage-word`), grouped
 * in sentences (spans with `sentenceClass`). The chapter's screen shows them as running text; the
 * reader sets each sentence on a line of its own.
 */
export function buildPassage(parts: readonly PassagePart[], sentenceClass: string): PassageDom {
  const sentences: HTMLElement[] = [];
  const words: HTMLElement[] = [];
  const sentenceOf: number[] = [];
  const hidden = new Map<string, HTMLElement>();
  let sentence = h('span', { class: sentenceClass });
  const close = () => {
    if (!sentence.textContent?.trim()) return;
    sentences.push(sentence);
    sentence = h('span', { class: sentenceClass });
  };
  const word = (el: HTMLElement) => {
    words.push(el);
    sentenceOf.push(sentences.length);
    sentence.append(el);
  };
  for (const part of parts) {
    if (part.word) {
      const mark = h('span', { class: 'passage-word' }, part.text);
      hidden.set(part.word, mark);
      word(mark);
      continue;
    }
    let last = 0;
    const between = (text: string) => {
      if (!text) return;
      // Text between words may end a sentence; what follows its space starts the next.
      const pieces = text.split(/(?<=[.!?][”"’)]*\s+)/);
      pieces.forEach((piece) => {
        sentence.append(piece);
        if (SENTENCE_END.test(piece)) close();
      });
    };
    for (const m of part.text.matchAll(SPOKEN_WORD)) {
      between(part.text.slice(last, m.index));
      word(h('span', { class: 'spoken' }, m[0]));
      last = m.index + m[0].length;
    }
    between(part.text.slice(last));
  }
  close();
  return { sentences, words, sentenceOf, hidden };
}
