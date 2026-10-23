/**
 * Records the narration for chapters: each passage read aloud by Kokoro (an open text-to-speech
 * model, Apache 2.0, free for commercial use), with every word timed so the game can light it up as
 * it's spoken.
 *   npm run narrate -- 1 2 3        the first three chapter files (numbers as in src/levels)
 *   npm run narrate -- 1 --voice bf_emma            the British narrator
 *   npm run narrate -- 1 --voice bm_george --speed 1
 *
 * Writes public/audio/<voice>/<id>.mp3 and src/narration/<voice>/<id>.json: each voice its own set, so
 * the player can pick the narrator (see VOICES in src/narration/index.ts). Needs the narrator's Python environment
 * once (see docs/narration.md) and ffmpeg on the PATH.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKS } from '../src/core/books.ts';
import { passageParts, passageText, passageTokens } from '../src/core/passage.ts';
import type { LevelDef } from '../src/core/types.ts';
import { fillGaps } from './narration-gaps.ts';

const root = join(import.meta.dirname, '..');
const levelsDir = join(root, 'src', 'levels');
const audioDir = join(root, 'public', 'audio');
const timingsDir = join(root, 'src', 'narration');
const work = join(root, '.tmp', 'narration');
const python = join(root, '.venv-tts', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args.splice(at, 2)[1] : fallback;
};
/** The default narrator: Kokoro's American af_heart, whose unhurried pacing suits reading along. Other voices: docs/narration.md. */
const voice = option('voice', 'af_heart');
const speed = Number(option('speed', '0.95'));
const only = new Set(args.map(Number).filter(Boolean));
if (!only.size) {
  console.error('Say which chapter files to narrate, e.g. npm run narrate -- 1 2 3');
  process.exit(1);
}

const files = readdirSync(levelsDir).filter((f) => f.endsWith('.json') && only.has(Number(f.slice(0, 3))));
const chapters = files.map((f) => {
  const def = JSON.parse(readFileSync(join(levelsDir, f), 'utf8')) as LevelDef;
  const parts = passageParts(def.story.text, BOOKS[def.book].names);
  return { id: def.id, text: passageText(parts), words: passageTokens(parts) };
});

rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const job = join(work, 'job.json');
// American voices (a*) read with American English, British ones (b*) with British.
writeFileSync(job, JSON.stringify({ voice, speed, lang: voice[0], chapters }));
const read = spawnSync(python, [join(root, 'scripts', 'narrate.py'), job, work], { stdio: 'inherit' });
if (read.status !== 0) process.exit(read.status ?? 1);

mkdirSync(join(audioDir, voice), { recursive: true });
mkdirSync(join(timingsDir, voice), { recursive: true });
for (const { id, words } of chapters) {
  const mp3 = join(audioDir, voice, `${id}.mp3`);
  // Mono, 48 kbps: a spoken passage needs no more, and it keeps each chapter near 100 KB.
  const enc = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(work, `${id}.wav`), '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '48k', mp3], { stdio: 'inherit' });
  if (enc.status !== 0) process.exit(enc.status ?? 1);
  // The few words the narrator read as one with the next (twenty-seven), timed from the words around them.
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3], { encoding: 'utf8' });
  const times = fillGaps(words, JSON.parse(readFileSync(join(work, `${id}.json`), 'utf8')), Number(probe.stdout) || undefined);
  writeFileSync(join(timingsDir, voice, `${id}.json`), `${JSON.stringify({ voice, speed, audio: `audio/${voice}/${id}.mp3`, words: times })}\n`);
  console.log(`✓ ${id}: ${words.length} words → public/audio/${voice}/${id}.mp3`);
}
