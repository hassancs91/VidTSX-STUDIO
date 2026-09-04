// T1 — compare two pictures frame-for-frame at chosen frame indices (t8-output-diff generalised)
// (docs/PREVIEW_TESTS_PLAN.md §T8): the colour diff between the OffthreadVideo
// control and the @remotion/media export (T8a), and the fidelity still for the
// ffmpeg passthrough (T8c).
//
//   node scripts/bench/t1-diff.mjs --a=<control.mp4|png-template> --b=<other.mp4|png-template> --label=t1-preview-vs-export [--frames=30,300,600,870] [--resize=a|b]
//
// Either side may be a video (frames pulled by INDEX, select=eq(n,N)) or a
// PNG template with {f} for the frame number (e.g. a Player screenshot from
// t1-preview-capture.mjs). --resize=b scales side b to side a's size (lanczos)
// before diffing, for the --natural preview captures; default: sizes must match.
//
// Frames are pulled by INDEX (select=eq(n\,N)) so both files are compared at
// the same timeline frame regardless of container timestamps; both must be
// 30 fps CFR (every Studio export is; the ffmpeg runs are conformed with -r 30).
// Per frame: mean absolute difference per channel (0–255), the fraction of
// pixels whose max-channel delta exceeds 8 and 24, and a side-by-side PNG
// (a | b | amplified diff) under .vidtsx-temp/bench/t8/stills/.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't1', 'stills');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const frames = (args.frames ?? '30,300,600,870').split(',').map(Number);
const label = args.label ?? 'diff';
// --b-offset=<frames>: side b's index is n - offset (a sub-composition rendered from startFrom, checked against the full export).
const bOffset = Number(args['b-offset'] ?? 0);

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffmpeg.exe');
}

async function frameOf(ffmpeg, spec, n, out) {
  if (spec.includes('{f}')) { await fs.copyFile(spec.replace('{f}', String(n)), out); return; }
  await extract(ffmpeg, spec, n, out);
}

function extract(ffmpeg, file, n, out) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-y', '-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`, '-vframes', '1', '-pix_fmt', 'rgb24', out], { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code} extracting frame ${n} of ${file}`))));
  });
}

async function main() {
  const ffmpeg = findFfmpeg();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const rows = [];
  for (const n of frames) {
    const pa = path.join(OUT_DIR, `${label}-f${n}-a.png`);
    const pb = path.join(OUT_DIR, `${label}-f${n}-b.png`);
    await frameOf(ffmpeg, args.a, n, pa);
    await frameOf(ffmpeg, args.b, n - bOffset, pb);
    if (args.resize === 'b') { const m = await sharp(pa).metadata(); await sharp(pb).resize(m.width, m.height, { kernel: 'lanczos3' }).toFile(pb + '.r.png'); await fs.rename(pb + '.r.png', pb); }
    if (args.resize === 'a') { const m = await sharp(pb).metadata(); await sharp(pa).resize(m.width, m.height, { kernel: 'lanczos3' }).toFile(pa + '.r.png'); await fs.rename(pa + '.r.png', pa); }
    const ia = sharp(pa).removeAlpha().raw();
    const ib = sharp(pb).removeAlpha().raw();
    const [A, B] = await Promise.all([ia.toBuffer({ resolveWithObject: true }), ib.toBuffer({ resolveWithObject: true })]);
    if (A.info.width !== B.info.width || A.info.height !== B.info.height) throw new Error(`size mismatch at frame ${n}: ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}`);
    const px = A.info.width * A.info.height;
    const sum = [0, 0, 0];
    let over8 = 0, over24 = 0, maxD = 0;
    const diff = Buffer.alloc(px * 3);
    for (let i = 0; i < px; i++) {
      let m = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(A.data[i * 3 + c] - B.data[i * 3 + c]);
        sum[c] += d;
        if (d > m) m = d;
        diff[i * 3 + c] = Math.min(255, d * 8);
      }
      if (m > 8) over8++;
      if (m > 24) over24++;
      if (m > maxD) maxD = m;
    }
    const meanA = [0, 0, 0], meanB = [0, 0, 0];
    for (let i = 0; i < px; i++) for (let c = 0; c < 3; c++) { meanA[c] += A.data[i * 3 + c]; meanB[c] += B.data[i * 3 + c]; }
    const row = {
      frame: n,
      meanAbsDiff: sum.map((s) => Math.round((s / px) * 100) / 100),
      meanA: meanA.map((s) => Math.round(s / px)), meanB: meanB.map((s) => Math.round(s / px)),
      pctOver8: Math.round((over8 / px) * 10000) / 100, pctOver24: Math.round((over24 / px) * 10000) / 100, maxDelta: maxD,
    };
    rows.push(row);
    const w = A.info.width, h = A.info.height;
    const scale = Math.min(1, 640 / w);
    const tiles = await Promise.all([
      sharp(pa).resize(Math.round(w * scale)).png().toBuffer(),
      sharp(pb).resize(Math.round(w * scale)).png().toBuffer(),
      sharp(diff, { raw: { width: w, height: h, channels: 3 } }).resize(Math.round(w * scale)).png().toBuffer(),
    ]);
    const tw = Math.round(w * scale), th = Math.round(h * scale);
    await sharp({ create: { width: tw * 3 + 8, height: th, channels: 3, background: '#000' } })
      .composite([{ input: tiles[0], left: 0, top: 0 }, { input: tiles[1], left: tw + 4, top: 0 }, { input: tiles[2], left: tw * 2 + 8, top: 0 }])
      .png().toFile(path.join(OUT_DIR, `${label}-f${n}-side-by-side.png`));
    console.log(JSON.stringify(row));
  }
  const summary = { label, a: args.a, b: args.b, frames: rows, at: new Date().toISOString() };
  await fs.writeFile(path.join(OUT_DIR, `${label}.json`), JSON.stringify(summary, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
