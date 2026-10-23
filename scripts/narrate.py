"""
Reads chapter passages aloud with Kokoro (an open text-to-speech model, Apache 2.0) and times each word.
Called by scripts/narrate.ts, which says what to read; not meant to be run by hand.

    narrate.py <job.json> <out dir>

job.json: {"voice": "bf_emma", "speed": 0.95, "chapters": [{"id", "text", "words": [...]}]}
For each chapter it writes <out>/<id>.wav and <out>/<id>.json: one [start, end] in seconds per word
of "words", in order (null where a word couldn't be matched; the game then skips it).
"""

import json
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from kokoro import KPipeline  # noqa: E402

RATE = 24000
LETTERS = re.compile(r"[a-z0-9]")


def letters(text: str) -> str:
    return "".join(LETTERS.findall(text.lower()))


def read_aloud(pipeline: KPipeline, text: str, voice: str, speed: float):
    """The passage's audio, and its spoken tokens as (letters, start, end) across the whole of it."""
    audio, spoken, offset = [], [], 0.0
    for result in pipeline(text, voice=voice, speed=speed):
        chunk = result.audio.numpy()
        for token in result.tokens or []:
            key = letters(token.text)
            if key and token.start_ts is not None and token.end_ts is not None:
                spoken.append((key, offset + token.start_ts, offset + token.end_ts))
        audio.append(chunk)
        offset += len(chunk) / RATE
    return np.concatenate(audio), spoken


def align(words: list[str], spoken: list[tuple[str, float, float]]):
    """
    Matches the game's words to the narrator's tokens by their letters. A word the narrator split
    (Darcy + 's) takes the tokens it spans; one it can't match is left null and the reading resyncs
    on the next word that does.
    """
    def match_at(j: int, target: str):
        k, acc, start, end = j, "", None, None
        while k < len(spoken) and len(acc) < len(target):
            acc += spoken[k][0]
            start = spoken[k][1] if start is None else start
            end = spoken[k][2]
            k += 1
        return (k, [round(start, 3), round(end, 3)]) if acc == target else None

    times, j = [], 0
    for word in words:
        target = letters(word)
        # Where the narrator said something extra just before (a token it split differently), look a
        # few tokens ahead before giving up on this word.
        hit = next((m for skip in range(4) if (m := match_at(j + skip, target))), None)
        if hit:
            j, span = hit
            times.append(span)
        else:
            times.append(None)
    return times


def main() -> None:
    job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    pipeline = KPipeline(lang_code=job.get("lang", "b"), repo_id="hexgrad/Kokoro-82M")
    for chapter in job["chapters"]:
        audio, spoken = read_aloud(pipeline, chapter["text"], job["voice"], job["speed"])
        times = align(chapter["words"], spoken)
        sf.write(out / f"{chapter['id']}.wav", audio, RATE)
        (out / f"{chapter['id']}.json").write_text(json.dumps(times), encoding="utf-8")
        missed = [w for w, t in zip(chapter["words"], times) if t is None]
        print(f"{chapter['id']}: {len(audio) / RATE:.1f}s, {len(times) - len(missed)}/{len(times)} words timed" + (f", unmatched: {missed}" if missed else ""), flush=True)


if __name__ == "__main__":
    main()
