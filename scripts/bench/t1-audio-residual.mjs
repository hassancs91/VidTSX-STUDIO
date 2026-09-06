// Export-engines Stage 3 slice 2 — is a MIXED track at the right place and
// level? A music clip under a camera track is too quiet for a normalised
// cross-correlation against the music file to lock on reliably (the camera
// audio dominates; a periodic tone gives false peaks). So: subtract the camera
// file's audio from the export (both at the same timeline time, lag 0 by the
// t1-audio-offset gate), which leaves the music plus AAC noise, and correlate
// THAT residual with the music file at music time (export time − musicOffset).
//
//   node scripts/bench/t1-audio-residual.mjs --export=<export.mp4> --camera=<camera.MP4> --music=<music.wav> \
//        --music-offset=3 [--camera-offset=0] [--gain=0.5] [--windows=7,13,14.5,16,22] [--search=1.5]
//
// --music-offset: export time − music time (a clip at timeline 5 s from source
// 2 s → 3). --camera-offset: export time − camera time (0 on the T1 cut, whose
// two clips read their own timeline positions). --gain: the clip's gain, so
// the level column reads 1.000 when the residual is the music at that gain.
// Prints lag (expect 0 ms), correlation (expect > 0.97 through an AAC round
// trip) and the residual's RMS over gain × the music's RMS (expect ≈ 0.98).
import { spawn } from 'child_process';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const RATE = 48000;
const windows = (args.windows ?? '7,13,14.5,16,22').split(',').map(Number);
const musicOffset = Number(args['music-offset'] ?? 0);
const cameraOffset = Number(args['camera-offset'] ?? 0);
const gain = Number(args.gain ?? 1);
const search = Number(args.search ?? 1.5);

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

/** Whole-file decode, like t1-audio-offset.mjs — `-ss` on an AAC mp4 can land 16 samples off, which breaks the subtraction. */
function decodeAll(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ['-v', 'error', '-nostdin', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
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
const slice = (x, from, dur) => x.subarray(Math.max(0, Math.round(from * RATE)), Math.max(0, Math.round(from * RATE)) + Math.round(dur * RATE));
const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / Math.max(1, x.length));

if (!args.export || !args.camera || !args.music) { console.error('usage: --export=<mp4> --camera=<file> --music=<file> [--music-offset=s] [--camera-offset=s] [--gain=g] [--windows=...] [--search=s]'); process.exit(1); }
console.log(`export ${args.export}\ncamera ${args.camera} (offset ${cameraOffset} s)\nmusic  ${args.music} (offset ${musicOffset} s, gain ${gain})`);
console.log('window_s  lag_ms   corr    rms_resid  rms_music×g  ratio');
const [E, C, M] = await Promise.all([decodeAll(args.export), decodeAll(args.camera), decodeAll(args.music)]);
for (const t of windows) {
  const len = 1 + 2 * search;
  const e = slice(E, t - search, len);
  const c = slice(C, t - search - cameraOffset, len);
  const n = Math.min(e.length, c.length);
  const resid = new Float32Array(n);
  for (let i = 0; i < n; i++) resid[i] = e[i] - c[i];
  const m = slice(M, t - musicOffset, 1);
  let mm = 0;
  for (const v of m) mm += v * v;
  let best = { lag: 0, corr: -2 };
  for (let lag = 0; lag + m.length <= n; lag++) {
    let rc = 0;
    let cc = 0;
    for (let i = 0; i < m.length; i++) { const r = resid[lag + i]; rc += m[i] * r; cc += r * r; }
    const corr = rc / Math.sqrt(mm * cc + 1e-12);
    if (corr > best.corr) best = { lag, corr };
  }
  const lagMs = (best.lag / RATE - search) * 1000;
  const aligned = resid.subarray(best.lag, best.lag + m.length);
  const rr = rms(aligned);
  const mg = gain * rms(m);
  console.log(`${t.toFixed(1).padStart(7)}  ${lagMs.toFixed(2).padStart(7)}  ${best.corr.toFixed(3)}  ${rr.toFixed(5).padStart(9)}  ${mg.toFixed(5).padStart(11)}  ${(rr / mg).toFixed(4)}`);
}
