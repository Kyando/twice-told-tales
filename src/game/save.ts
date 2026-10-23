/**
 * Local persistence (per browser). Only finished chapters are kept: a chapter is either new or
 * done. Words found in an unfinished chapter live in memory while it's open (see App).
 */

/** A chapter being played: the words found so far, by text. */
export interface LevelProgress {
  found: string[];
  done: boolean;
  /** Traces that weren't a word. */
  misses: number;
}

export interface SaveData {
  version: 1;
  /** The finished chapters, by id. */
  levels: Record<string, { done: true }>;
  /** The paid shelves the player owns (see SHELVES in core/books.ts). */
  shelves: string[];
  /** `accent`: the narrator's voice, American or British (see VOICES in src/narration). */
  settings: { sound: boolean; seenHelp: boolean; clue: Clue; accent: Accent };
}

/**
 * What the player reads to find the words: the chapter's passage, unmarked (the hidden words are
 * somewhere in it), or the old list of the words themselves. Kept as a choice while both are playtested.
 */
export type Clue = 'passage' | 'list';

import type { Accent } from '../narration/index.ts';
import { keepStored, restoreStored } from '../native.ts';

const KEY = 'pages-and-pieces:v1';

const defaults = (): SaveData => ({
  version: 1,
  levels: {},
  shelves: [],
  settings: { sound: true, seenHelp: false, clue: 'passage', accent: 'american' },
});

export const emptyProgress = (): LevelProgress => ({ found: [], done: false, misses: 0 });

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw) as { version?: number; levels?: Record<string, { done?: boolean }>; settings?: Partial<SaveData['settings']>; shelves?: unknown };
    if (data.version !== 1) return defaults();
    // Older saves also kept the words found in unfinished chapters: only the finished ones stay.
    const levels: SaveData['levels'] = {};
    for (const [id, p] of Object.entries(data.levels ?? {})) if (p?.done) levels[id] = { done: true };
    const { sound, seenHelp, clue, accent } = { ...defaults().settings, ...data.settings };
    const shelves = Array.isArray(data.shelves) ? data.shelves.filter((s): s is string => typeof s === 'string') : [];
    return { version: 1, levels, shelves, settings: { sound, seenHelp, clue: clue === 'list' ? 'list' : 'passage', accent: accent === 'british' ? 'british' : 'american' } };
  } catch {
    return defaults();
  }
}

/** In the phone app, brings back the save kept outside the WebView; call before the first loadSave. */
export const restoreSave = (): Promise<void> => restoreStored(KEY);

export function writeSave(data: SaveData): void {
  const raw = JSON.stringify(data);
  keepStored(KEY, raw);
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // Storage unavailable (private mode, quota): the game still works for this session.
  }
}
