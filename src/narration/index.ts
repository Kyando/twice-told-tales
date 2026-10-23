/**
 * Recorded narration, by voice and chapter id: made by `npm run narrate` (see scripts/narrate.ts).
 * The audio lives in public/audio/<voice>; these files (./<voice>/<id>.json) hold its word timings,
 * one [start, end] in seconds per word of passageTokens (null for a word the narrator's timing
 * couldn't be matched to).
 */
export interface Narration {
  voice: string;
  speed: number;
  /** The recording, relative to the page. */
  audio: string;
  words: ([number, number] | null)[];
}

/** The narrators the player can pick from (in the menu), by accent; each has its own recordings. */
export const VOICES = {
  american: 'af_heart',
  british: 'bf_emma',
} as const;

export type Accent = keyof typeof VOICES;

const files = import.meta.glob<Narration>('./*/*.json', { eager: true, import: 'default' });

/** Every recording, as NARRATION[voice][chapter id]. */
export const NARRATION: Record<string, Record<string, Narration>> = {};
for (const [path, narration] of Object.entries(files)) {
  const [, voice, file] = path.split('/');
  (NARRATION[voice] ??= {})[file.slice(0, -'.json'.length)] = narration;
}

/** A chapter's narration in the accent the player picked, or in the other one if that's all it has. */
export function narrationFor(id: string, accent: Accent): Narration | undefined {
  const other: Accent = accent === 'british' ? 'american' : 'british';
  return NARRATION[VOICES[accent]]?.[id] ?? NARRATION[VOICES[other]]?.[id];
}
