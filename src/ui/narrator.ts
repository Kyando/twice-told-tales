import type { Narration } from '../narration/index.ts';

/** A silence this long after a word (s) puts its light out. */
const PAUSE_S = 0.3;

/** Where the reading is: the word being spoken (-1 between words), the time, and whether it plays. */
export interface ReadingState {
  word: number;
  time: number;
  playing: boolean;
}

/**
 * A chapter's recorded narration: plays it, and tells whoever follows along (the passage on the
 * chapter's screen, the full-screen reader) which word is being spoken, every frame while it plays
 * and whenever it's paused or moved.
 */
export class Narrator {
  readonly times: Narration['words'];
  private readonly audio: HTMLAudioElement;
  private readonly followers = new Set<(state: ReadingState) => void>();
  private frame = 0;

  constructor(narration: Narration) {
    this.audio = new Audio(narration.audio);
    this.audio.preload = 'none';
    this.times = narration.words;
    this.audio.addEventListener('play', () => this.tick());
    this.audio.addEventListener('pause', () => this.tell());
    this.audio.addEventListener('seeked', () => this.tell());
    this.audio.addEventListener('loadedmetadata', () => this.tell());
    this.audio.addEventListener('ended', () => {
      this.audio.currentTime = 0;
      this.tell();
      this.enders.forEach((fn) => fn());
    });
  }

  private readonly enders = new Set<() => void>();

  /** Calls `fn` each time the reading gets to the end (the edition goes on to the next chapter). */
  onEnded(fn: () => void): () => void {
    this.enders.add(fn);
    return () => this.enders.delete(fn);
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  get time(): number {
    return this.audio.currentTime;
  }

  /** The recording's length (s): from the file once known, until then from the last word's end. */
  get duration(): number {
    const known = this.audio.duration;
    if (Number.isFinite(known) && known > 0) return known;
    return this.times.reduce((end, span) => Math.max(end, span?.[1] ?? 0), 0) + 0.4;
  }

  get rate(): number {
    return this.audio.playbackRate;
  }

  /** Slower for learners; the voice keeps its pitch. */
  set rate(rate: number) {
    this.audio.playbackRate = rate;
  }

  /** Starts loading the recording (opening the reader does, so its length is known). */
  prepare(): void {
    if (this.audio.preload !== 'auto') this.audio.preload = 'auto';
  }

  play(): void {
    void this.audio.play().catch(() => this.tell());
  }

  pause(): void {
    this.audio.pause();
  }

  /** Plays from where it left off (or from the start once it's ended), or pauses. */
  toggle(): void {
    if (this.audio.paused) this.play();
    else this.pause();
  }

  seek(seconds: number): void {
    this.audio.currentTime = Math.max(0, Math.min(seconds, this.duration));
    this.tell();
  }

  /** Back to a word, a little before it so its first sound isn't clipped. */
  seekWord(index: number): void {
    const span = this.times[index];
    if (span) this.seek(span[0] - 0.05);
  }

  /** The word heard at a time: the last to have started, until a longer silence after it. */
  wordAt(t: number): number {
    let at = -1;
    this.times.forEach((span, i) => {
      if (span && span[0] <= t) at = i;
    });
    const span = this.times[at];
    return span && t > span[1] + PAUSE_S ? -1 : at;
  }

  /** Calls `fn` with each change of the reading, starting now; returns a function to stop. */
  follow(fn: (state: ReadingState) => void): () => void {
    this.followers.add(fn);
    fn(this.state());
    return () => this.followers.delete(fn);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.followers.clear();
    this.enders.clear();
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
  }

  private state(): ReadingState {
    const time = this.audio.currentTime;
    return { word: this.playing || time > 0 ? this.wordAt(time) : -1, time, playing: this.playing };
  }

  private tell(): void {
    const state = this.state();
    this.followers.forEach((fn) => fn(state));
  }

  private tick(): void {
    cancelAnimationFrame(this.frame);
    this.tell();
    if (this.playing) this.frame = requestAnimationFrame(() => this.tick());
  }
}

/** Lights the word being spoken (`is-spoken`) among `words`, as the narrator reads. */
export function lightSpokenWord(narrator: Narrator, words: readonly HTMLElement[]): () => void {
  let lit = -1;
  return narrator.follow(({ word, playing }) => {
    const at = playing ? word : -1;
    if (at === lit) return;
    words[lit]?.classList.remove('is-spoken');
    words[at]?.classList.add('is-spoken');
    lit = at;
  });
}
