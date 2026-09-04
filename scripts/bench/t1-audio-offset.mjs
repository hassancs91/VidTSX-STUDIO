// T1 leg 3 — is the audio at a join seam offset? (docs/PREVIEW_TESTS_PLAN.md §T1)
//
//   node scripts/bench/t1-audio-offset.mjs --a=<reference.mp4> --b=<candidate.mp4> [--b-offset=0] [--windows=0.5,7,14,15.2,22,29] [--label=t1-audio-join]
//
// Decodes both files to 48 kHz mono PCM (ffmpeg), then for each window start
// (seconds in the reference) takes 1 s of the reference and finds the lag in
// ±120 ms at which the candidate's normalised cross-correlation peaks. A join
// whose audio is right reports ~0 ms at every window; an AAC priming gap or a
// dropped frame at the seam shows up as a lag that changes across the seam.
// --b-offset shifts the candidate's timeline (seconds) when it starts at a
// different source time than the reference (e.g. a 15–30 s span against the
// 0–30 s export: --b-offset=15).

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't1', 'audio');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const RATE = 48000;
const windows = (args.windows ?? '0.5,7,14,15.2,22,29').split(',').map(Number);
const bOffset = Number(args['b-offset'] ?? 0);
const MAX_LAG_MS = 120;

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffmpeg.exe');
}

function decode(ffmpeg, file) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
    const chunks = [];
    child.stdout.on('data', (d) => chunks.push(d));
    child.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code} decoding ${file}`));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}

function bestLag(ref, cand, refStart, candStart, len, maxLag) {
  let best = { lag: 0, corr: -2 };
  const rs = ref.subarray(refStart, refStart + len);
  let rr = 0; for (let i = 0; i < len; i++) rr += rs[i] * rs[i];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const cs = candStart + lag;
    if (cs < 0 || cs + len > cand.length) continue;
    let rc = 0, cc = 0;
    for (let i = 0; i < len; i++) { const c = cand[cs + i]; rc += rs[i] * c; cc += c * c; }
    const corr = rc / Math.sqrt(rr * cc + 1e-12);
    if (corr > best.corr) best = { lag, corr };
  }
  return best;
}

async function main() {
  const ffmpeg = findFfmpeg();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const [A, B] = await Promise.all([decode(ffmpeg, args.a), decode(ffmpeg, args.b)]);
  const rows = [];
  const len = RATE; // 1 s
  const maxLag = Math.round((MAX_LAG_MS / 1000) * RATE);
  for (const w of windows) {
    const refStart = Math.round(w * RATE);
    const candStart = Math.round((w - bOffset) * RATE);
    if (refStart + len > A.length || candStart + len > B.length || candStart < 0) { rows.push({ window: w, skipped: true }); continue; }
    const r = bestLag(A, B, refStart, candStart, len, maxLag);
    const row = { window: w, lagMs: Math.round((r.lag / RATE) * 10000) / 10, lagSamples: r.lag, corr: Math.round(r.corr * 1000) / 1000 };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const out = { label: args.label ?? 'audio-offset', a: args.a, b: args.b, bOffset, durationA: A.length / RATE, durationB: B.length / RATE, rows, at: new Date().toISOString() };
  console.log(JSON.stringify({ durationA: out.durationA, durationB: out.durationB }));
  await fs.writeFile(path.join(OUT_DIR, `${out.label}.json`), JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
