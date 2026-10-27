/**
 * A chapter's passage as the player reads it: plain text, with the hidden words in place and written
 * as the book would (names capitalised, sentence starts too), each one tagged with its word.
 */
export type PassagePart = { text: string; word?: string };

/** Letters only, upper case: how a passage word would be traced on the board. */
const LETTERS = /\p{L}+/gu;

/** Titles written with a full stop that doesn't end the sentence: Mr. Darcy, Mrs. Bennet. */
const TITLE_STOP = /\b(?:Mr|Mrs|Ms|Messrs|Dr|St|Rev|Col|Capt|Gen|Lt)\.\s+$/;

/**
 * Whether text ends a sentence, so the next word starts one: at the very start, or after a stop
 * (with any closing quote) and a space, unless the stop belongs to a title such as Mr.
 */
export const endsSentence = (text: string): boolean =>
  text === '' || (/[.!?][”"’)]*\s+$/.test(text) && !TITLE_STOP.test(text));

/** Words always written with a capital, whatever the book: months, days, feasts, countries (not MAY or MARCH, everyday words too). */
const PROPER = new Set(
  'JANUARY FEBRUARY APRIL JUNE JULY AUGUST SEPTEMBER OCTOBER NOVEMBER DECEMBER MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY CHRISTMAS EASTER ENGLAND ENGLISH LONDON FRANCE FRENCH SCOTLAND IRELAND AMERICA GOD'.split(' '),
);

/** How a hidden word reads in running text. */
export function caseWord(word: string, names: readonly string[], startsSentence: boolean): string {
  const lower = word.toLowerCase();
  return names.includes(word) || PROPER.has(word) || startsSentence ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
}

/** The passage split into plain text and hidden words, in reading order. */
export function passageParts(text: string, names: readonly string[]): PassagePart[] {
  const parts: PassagePart[] = [];
  let before = '';
  text.split(/\{(\p{Lu}+)\}/u).forEach((part, k) => {
    if (k % 2 === 0) {
      if (part) parts.push({ text: part });
      before += part;
      return;
    }
    const shown = caseWord(part, names, endsSentence(before));
    parts.push({ text: shown, word: part });
    before += shown;
  });
  return parts;
}

/** A spoken word in running text: letters and digits, with an inner apostrophe (don’t, Darcy’s). */
export const SPOKEN_WORD = /[A-Za-z0-9]+(?:[’'][A-Za-z]+)*/g;

/**
 * The passage's words as read aloud, in order: each hidden word is one, and the plain text between
 * them is split by SPOKEN_WORD. The narration's timings (src/narration) line up with this list, one
 * [start, end] per word, so the game and the narration script must both split the passage this way.
 */
export function passageTokens(parts: readonly PassagePart[]): string[] {
  return parts.flatMap((part) => (part.word ? [part.text] : [...part.text.matchAll(SPOKEN_WORD)].map((m) => m[0])));
}

/** The passage as shown, as one string: what the narrator reads. */
export const passageText = (parts: readonly PassagePart[]): string => parts.map((p) => p.text).join('');

/**
 * The passage's other words, the ones not hidden on the board: what a reader might look for and not
 * find. Upper case, without repeats.
 */
export function decoysOf(text: string, hidden: readonly string[]): string[] {
  const plain = text.replace(/\{(\p{Lu}+)\}/gu, ' ');
  const set = new Set<string>();
  for (const m of plain.matchAll(LETTERS)) {
    const w = m[0].toUpperCase();
    if (!hidden.includes(w)) set.add(w);
  }
  return [...set];
}
