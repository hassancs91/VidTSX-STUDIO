// T1 — which SOURCE frame does a Remotion export show at composition frame f?
// (docs/PREVIEW_TESTS_PLAN.md §T1, leg 2's prerequisite.)
//
//   node scripts/bench/t1-frame-map.mjs --export=<remotion-export.mp4 | png-template-with-{f}> --source=<camera.mp4> [--source-in=0] [--rate=1 --from=0] [--frames=30,300,600,870,899] [--label=t1-map-hevc]
//
// --export may also be a PNG template with {f} for the frame number (the
// Player screenshots from t1-preview-capture.mjs), which answers the same
// question for the PREVIEW: which source frame does the <video> show at f.
//
// The export is 30 fps CFR; the source is 59.94 fps (60000/1001). For each
// composition frame f the export shows ONE source frame, and the candidates
// are the few source frames around t = sourceIn + f/30. This pulls the export
// frame by index and 6 source frames around t (input-seeked, `showinfo` gives
// each one's real pts so its index K = round(pts·60000/1001) is known, not
// assumed), scales both to the export size, and reports the mean absolute
// difference per candidate. The best candidate per f, read against the two
// obvious rules — "last frame with pts ≤ t" (what a <video> element shows at
// currentTime = t) and "nearest pts to t" — is the mapping rule leg 2 has to
// reproduce in ffmpeg.
//
// Output: .vidtsx-temp/bench/t1/<label>.json and one line per frame on stdout.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't1', 'frame-map');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const frames = (args.frames ?? '30,300,600,870,899').split(',').map(Number);
const label = args.label ?? 't1-frame-map';
const sourceIn = Number(args['source-in'] ?? 0);
// Slice 3 speed measurement: a clip at playbackRate `rate` starting at composition
// frame `from` shows source time sourceIn + rate * (f - from) / 30 at frame f.
const rate = Number(args.rate ?? 1);
const fromFrame = Number(args.from ?? 0);
const SRC_NUM = 60000, SRC_DEN = 1001; // 59.94 fps — both reference sources
const COMP_FPS = 30;

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffmpeg.exe');
}

function run(exe, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => (code === 0 ? resolve(err) : reject(new Error(`${path.basename(exe)} exit ${code}: ${err.slice(-800)}`))));
  });
}

async function extractExportFrame(ffmpeg, file, n, out) {
  await run(ffmpeg, ['-y', '-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`, '-vframes', '1', '-pix_fmt', 'rgb24', out]);
}

// Six source frames around t, with their real pts. Input-seek lands on the
// keyframe before the target and decodes forward, so the first emitted frame
// is the first with pts >= seek time; we seek two frames early to bracket t.
async function extractSourceCandidates(ffmpeg, file, t, prefix, w, h) {
  const kFirst = Math.max(0, Math.floor((t * SRC_NUM) / SRC_DEN) - 2);
  const seek = (kFirst * SRC_DEN) / SRC_NUM - 0.0005;
  const log = await run(ffmpeg, [
    '-y', '-v', 'info', '-hwaccel', 'cuda', '-ss', String(Math.max(0, seek)), '-copyts', '-i', file,
    '-vf', `showinfo,scale=${w}:${h}:flags=lanczos`, '-vframes', '6', '-fps_mode', 'passthrough', '-pix_fmt', 'rgb24', `${prefix}-%d.png`,
  ]);
  // showinfo lines carry the ABSOLUTE pts (-copyts) of each frame that reached the filter, in order.
  const pts = [...log.matchAll(/Parsed_showinfo.*?\bn:\s*(\d+).*?pts_time:\s*([\d.]+)/g)].map((m) => Number(m[2]));
  return pts.slice(0, 6).map((p, i) => ({ file: `${prefix}-${i + 1}.png`, ptsTime: p, k: Math.round((p * SRC_NUM) / SRC_DEN) }));
}

async function meanAbsDiff(aPath, bPath) {
  const [A, B] = await Promise.all([
    sharp(aPath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) throw new Error(`size mismatch ${A.info.width}x${A.info.height} vs ${B.info.width}x${B.info.height}`);
  const px = A.info.width * A.info.height;
  let sum = 0, over24 = 0;
  for (let i = 0; i < px * 3; i += 3) {
    let m = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(A.data[i + c] - B.data[i + c]); sum += d; if (d > m) m = d; }
    if (m > 24) over24++;
  }
  return { mean: Math.round((sum / (px * 3)) * 100) / 100, pctOver24: Math.round((over24 / px) * 10000) / 100 };
}

async function main() {
  const ffmpeg = findFfmpeg();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const rows = [];
  for (const f of frames) {
    const t = sourceIn + (rate * (f - fromFrame)) / COMP_FPS;
    const exportPng = path.join(OUT_DIR, `${label}-f${f}-export.png`);
    if (args.export.includes('{f}')) await fs.copyFile(args.export.replace('{f}', String(f)), exportPng);
    else await extractExportFrame(ffmpeg, args.export, f, exportPng);
    const meta = await sharp(exportPng).metadata();
    const cands = await extractSourceCandidates(ffmpeg, args.source, t, path.join(OUT_DIR, `${label}-f${f}-src`), meta.width, meta.height);
    for (const c of cands) Object.assign(c, await meanAbsDiff(exportPng, c.file));
    const best = cands.reduce((a, b) => (b.mean < a.mean ? b : a));
    const kFloor = Math.floor((t * SRC_NUM) / SRC_DEN + 1e-9); // last pts <= t
    const kNearest = Math.round((t * SRC_NUM) / SRC_DEN);
    const kCeil = Math.ceil((t * SRC_NUM) / SRC_DEN - 1e-9);
    const row = {
      frame: f, t: Math.round(t * 1e6) / 1e6, bestK: best.k, bestPts: best.ptsTime, bestMean: best.mean,
      rule: best.k === kFloor && best.k === kNearest ? 'floor=nearest' : best.k === kFloor ? 'floor' : best.k === kNearest ? 'nearest' : best.k === kCeil ? 'ceil' : 'none',
      kFloor, kNearest, kCeil,
      candidates: cands.map((c) => ({ k: c.k, pts: c.ptsTime, mean: c.mean, pctOver24: c.pctOver24 })),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
    for (const c of cands) if (c !== best) await fs.rm(c.file, { force: true });
    await fs.rename(best.file, path.join(OUT_DIR, `${label}-f${f}-src-K${best.k}.png`));
  }
  await fs.writeFile(path.join(OUT_DIR, `${label}.json`), JSON.stringify({ label, export: args.export, source: args.source, sourceIn, rows, at: new Date().toISOString() }, null, 2));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
