import type { Narration } from '../narration/index.ts';

/** A silence this long after a word (s) puts its light out. */
const PAUSE_S = 0.3;

/**
 * Plays a chapter's recorded narration and follows it through the passage: the word being spoken
 * takes the `is-spoken` class while it's heard. `words` are the passage's word elements, in the
 * order the narration's timings list them.
 */
export class Narrator {
  private readonly audio: HTMLAudioElement;
  private readonly words: readonly HTMLElement[];
  private readonly times: Narration['words'];
  private readonly onChange: (playing: boolean) => void;
  private current = -1;
  private frame = 0;

  constructor(narration: Narration, words: readonly HTMLElement[], onChange: (playing: boolean) => void) {
    this.audio = new Audio(narration.audio);
    this.audio.preload = 'none';
    this.words = words;
    this.times = narration.words;
    this.onChange = onChange;
    this.audio.addEventListener('play', () => {
      this.onChange(true);
      this.follow();
    });
    this.audio.addEventListener('pause', () => this.stopFollowing());
    this.audio.addEventListener('ended', () => {
      this.stopFollowing();
      this.audio.currentTime = 0;
    });
  }

  get playing(): boolean {
    return !this.audio.paused;
  }

  /** Plays from where it left off (or from the start once it's ended), or pauses. */
  toggle(): void {
    if (this.audio.paused) void this.audio.play().catch(() => this.stopFollowing());
    else this.audio.pause();
  }

  destroy(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    cancelAnimationFrame(this.frame);
  }

  private stopFollowing(): void {
    cancelAnimationFrame(this.frame);
    this.mark(-1);
    this.onChange(false);
  }

  /**
   * Each frame, the last word to have started: it stays lit through the short gap before the next,
   * so the light doesn't flicker, and goes out in a longer pause (a full stop, a new paragraph).
   */
  private follow(): void {
    const t = this.audio.currentTime;
    let at = -1;
    this.times.forEach((span, i) => {
      if (span && span[0] <= t) at = i;
    });
    const span = this.times[at];
    if (span && t > span[1] + PAUSE_S) at = -1;
    this.mark(at);
    if (!this.audio.paused) this.frame = requestAnimationFrame(() => this.follow());
  }

  private mark(index: number): void {
    if (index === this.current) return;
    this.words[this.current]?.classList.remove('is-spoken');
    this.words[index]?.classList.add('is-spoken');
    this.current = index;
  }
}
