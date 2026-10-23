/**
 * Times the words the narrator's own timings missed. Kokoro reads some pairs of the game's words as one
 * word: "twenty-seven", "rabbit-hole", "Darcy’s" (where Darcy is hidden). The audio between the word
 * before and the word after is that word, so it's shared out among the pair by their letters. At the very end of the passage, the recording's
 * end (`duration`, in seconds, less its last moment of silence) stands in for the word after.
 */
export function fillGaps(words: readonly string[], times: ([number, number] | null)[], duration?: number): ([number, number] | null)[] {
  const out = [...times];
  for (let i = 0; i < out.length; i++) {
    if (out[i]) continue;
    let j = i;
    while (j < out.length && !out[j]) j++;
    const before = out[i - 1];
    const after: [number, number] | null | undefined = j === out.length && duration ? [duration - TAIL_S, duration] : out[j];
    if (before && after && after[0] > before[1]) {
      const sizes = words.slice(i, j).map((w) => w.replace(/[^A-Za-z0-9]/g, '').length || 1);
      const total = sizes.reduce((a, b) => a + b, 0);
      let at = before[1];
      sizes.forEach((size, k) => {
        const end = at + ((after[0] - before[1]) * size) / total;
        out[i + k] = [Math.round(at * 1000) / 1000, Math.round(end * 1000) / 1000];
        at = end;
      });
    }
    i = j;
  }
  return out;
}

/** The silence Kokoro leaves after the last word (s). */
const TAIL_S = 0.15;
