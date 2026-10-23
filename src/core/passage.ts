/**
 * A chapter's passage as the player reads it: plain text, with the hidden words in place and written
 * as the book would (names capitalised, sentence starts too), each one tagged with its word.
 */
export type PassagePart = { text: string; word?: string };

/** Letters only, upper case: how a passage word would be traced on the board. */
const LETTERS = /[A-Za-z]+/g;

/** Text ends a sentence here: the next word starts one. */
const SENTENCE_END = /(^|[.!?][”"’)]*\s+)$/;

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
  text.split(/\{([A-Z]+)\}/).forEach((part, k) => {
    if (k % 2 === 0) {
      if (part) parts.push({ text: part });
      before += part;
      return;
    }
    const shown = caseWord(part, names, SENTENCE_END.test(before));
    parts.push({ text: shown, word: part });
    before += shown;
  });
  return parts;
}

/**
 * The passage's other words, the ones not hidden on the board: what a reader might look for and not
 * find. Upper case, without repeats.
 */
export function decoysOf(text: string, hidden: readonly string[]): string[] {
  const plain = text.replace(/\{([A-Z]+)\}/g, ' ');
  const set = new Set<string>();
  for (const m of plain.matchAll(LETTERS)) {
    const w = m[0].toUpperCase();
    if (!hidden.includes(w)) set.add(w);
  }
  return [...set];
}
