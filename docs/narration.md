# Narration

Each chapter's passage can be read aloud in the game. The **Listen** button sits under the passage, and the word being spoken lights up as it's read. Tapping the passage opens the **reader**: the scene full screen, one sentence per line, read along word by word like song lyrics. Any word can be tapped to read from there, and the voice's speed can be picked from 0.25× to 2×.

There are two narrators, and the player picks one in the menu with the **British narrator** switch: `af_heart`, American (the default), and `bf_emma`, British. Each chapter is recorded in both. A chapter recorded in only one plays that one.

The recordings are made with [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M). It is an open text-to-speech model under the Apache 2.0 licence, so it's free to use in a commercial game, and it runs on this computer with no account or API key. It reports when each word is spoken, which is what lets the game light words up in time.

## Files

| What | Where |
|---|---|
| Recordings (mono MP3, 48 kbps, about 100 KB per chapter) | `public/audio/<voice>/<chapter id>.mp3` |
| Word timings: one `[start, end]` in seconds per word | `src/narration/<voice>/<chapter id>.json` |
| The narrators the player can pick | `VOICES` in `src/narration/index.ts` |
| The recorder (Node, runs the Python reader) | `scripts/narrate.ts` |
| The reader (Python, Kokoro) | `scripts/narrate.py` |

The words come from `passageTokens` in `src/core/passage.ts`, the same split the game uses on screen. A test checks that every timing file has exactly one timing per word, and that its recording exists.

A chapter's timings only fit the passage they were made from. **After changing a passage, record that chapter again.** If you don't, the test fails and the game hides that chapter's Listen button.

## One-time setup

You need Python 3.12 and ffmpeg. `uv` fetches Python 3.12 into the project's own folder, which git ignores:

```bash
uv venv --python 3.12 .venv-tts
uv pip install --python .venv-tts/Scripts/python.exe "kokoro>=0.9.4" soundfile "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
```

The first recording downloads the model, about 330 MB, into the Hugging Face cache.

## Recording

Pass the chapters by their file numbers, as in `src/levels`:

```bash
npm run narrate -- 1 2 3 4 5
```

Then the same chapters with the British narrator:

```bash
npm run narrate -- 1 2 3 4 5 --voice bf_emma
```

Options:
- `--voice <name>`: the default is `af_heart`, an American woman, chosen as the one narrator for every book for her unhurried pacing.
- `--speed <n>`: the default is `0.95`, a little slower than normal, which helps learners.

Voices that suit the books:

| Voice | Who |
|---|---|
| `af_heart` | American woman, Kokoro's highest-rated voice (default) |
| `bf_emma` | British woman (the British narrator) |
| `bf_isabella` | British woman, lighter; liked for its tone |
| `bm_george` | British man |

Voices starting with `b` read with British pronunciation, and those starting with `a` with American.
