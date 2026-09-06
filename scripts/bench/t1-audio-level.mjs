// Export-engines Stage 3 — the LEVEL of an export's audio against a reference,
// window by window (docs/export-engines-plan.md §Stage 3 log). Companion to
// t1-audio-offset.mjs, which measures the lag; this measures the 1 s RMS of
// both files at each window and prints the ratio (and dB), so a gained clip
// or a mixed track can be read against the camera file, the music file or a
// plain Remotion export of the same project.
//
//   node scripts/bench/t1-audio-level.mjs --a=<reference> --b=<candidate> [--b-offset=0] [--windows=0.5,7,13.5,14.5,15.2,16,22,29] [--win=1]
//
// --b-offset shifts the candidate's timeline (seconds) when it starts at a
// different source time than the reference. Decodes through the full ffmpeg
// when installed, else Remotion's.
import { spawn } from 'child_process';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const RATE = 48000;
const windows = (args.windows ?? '0.5,7,13.5,14.5,15.2,16,22,29').split(',').map(Number);
const bOffset = Number(args['b-offset'] ?? 0);
// Window length in seconds (1 s by default; 0.1 s reads a level INSIDE a fade ramp — slice 3).
const win = Number(args.win ?? 1);

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  if (fsSync.existsSync(root)) {
    const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
    if (dir) return path.join(root, dir, 'bin', 'ffmpeg.exe');
  }
  const remotion = path.join(REPO, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');
  if (fsSync.existsSync(remotion)) return remotion;
  throw new Error('no ffmpeg found');
}
const FFMPEG = findFfmpeg();

function decode(file, ss, t) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-nostdin', '-ss', String(ss), '-t', String(t), '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => { err += c; });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code}: ${err}`));
      const b = Buffer.concat(chunks);
      resolve(new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4)));
    });
  });
}
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / Math.max(1, x.length));

if (!args.a || !args.b) { console.error('usage: --a=<reference> --b=<candidate> [--b-offset=s] [--windows=...]'); process.exit(1); }
console.log(`reference ${args.a}\ncandidate ${args.b}${bOffset ? ` (offset ${bOffset} s)` : ''}`);
console.log('window_s  rms_ref   rms_cand  ratio   dB');
for (const w of windows) {
  const a = await decode(args.a, w, win);
  const b = await decode(args.b, w + bOffset, win);
  const ra = rms(a);
  const rb = rms(b);
  const ratio = rb / ra;
  console.log(`${w.toFixed(1).padStart(7)}  ${ra.toFixed(5)}  ${rb.toFixed(5)}  ${ratio.toFixed(4)}  ${(20 * Math.log10(ratio)).toFixed(2)}`);
}
