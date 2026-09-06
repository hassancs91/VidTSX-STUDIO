// Export-engines Stage 3 slice 3 — the effective GAIN CURVE of an export against
// its source, window by window (docs/export-engines-plan.md §Stage 3 log, slice
// 3). When an export plays the source file's own samples (a fade, or a
// crossfade between two clips of one file at the same time line), the ratio of
// the export's RMS to the source's in a short window IS the volume the export
// applied there, so a ramp can be read off directly and two exports compared.
//
//   node scripts/bench/t1-audio-gain-curve.mjs --source=<camera.MP4> --exports=<a.mp4>,<b.mp4> --from=14.4 --to=15.6 [--win=0.01] [--source-offset=0]
//
// --source-offset: export time − source time (0 on the T1 cut). Decodes whole
// files (never -ss on an AAC mp4) through the full ffmpeg.
import { spawn } from 'child_process';
import fsSync from 'fs';
import os from 'os';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const RATE = 48000;
const win = Number(args.win ?? 0.01);
const from = Number(args.from);
const to = Number(args.to);
const sourceOffset = Number(args['source-offset'] ?? 0);

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffmpeg.exe');
}
const FFMPEG = findFfmpeg();

function decode(file) {
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
const rms = (x, s, n) => { let a = 0; for (let i = s; i < s + n; i++) a += x[i] * x[i]; return Math.sqrt(a / n); };

if (!args.source || !args.exports || !Number.isFinite(from) || !Number.isFinite(to)) { console.error('usage: --source=<file> --exports=<a>,<b> --from=s --to=s [--win=0.01] [--source-offset=s]'); process.exit(1); }
const files = args.exports.split(',');
const source = await decode(args.source);
const exps = [];
for (const f of files) exps.push(await decode(f));
const n = Math.round(win * RATE);
console.log(`source ${args.source}\n${files.map((f, i) => `export${i + 1} ${f}`).join('\n')}`);
console.log(['t_s', 'rms_src', ...files.map((_, i) => `gain${i + 1}`)].join('\t'));
for (let t = from; t < to - 1e-9; t += win) {
  const s = Math.round((t - sourceOffset) * RATE);
  const e = Math.round(t * RATE);
  const r = rms(source, s, n);
  const gains = exps.map((x) => (r > 0 ? rms(x, e, n) / r : NaN));
  console.log([t.toFixed(3), r.toFixed(5), ...gains.map((g) => g.toFixed(3))].join('\t'));
}
