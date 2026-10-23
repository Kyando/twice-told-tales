/**
 * Recorded narration, by chapter id: made by `npm run narrate` (see scripts/narrate.ts). The audio
 * lives in public/audio; these files hold its word timings, one [start, end] in seconds per word of
 * passageTokens (null for a word the narrator's timing couldn't be matched to).
 */
export interface Narration {
  voice: string;
  speed: number;
  /** The recording, relative to the page. */
  audio: string;
  words: ([number, number] | null)[];
}

const files = import.meta.glob<Narration>('./*.json', { eager: true, import: 'default' });

export const NARRATION: Record<string, Narration> = Object.fromEntries(
  Object.entries(files).map(([path, narration]) => [path.slice(2, -'.json'.length), narration]),
);
