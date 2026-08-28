// T2 colour check — does swapping the decoder change the picture?
//
//   node scripts/bench/run-frame-diff.mjs --from-project=raw-footage-test --media=original
//
// Shows the SAME composition frame under both engines, screenshots the
// composited page each time, and diffs the pixels.
//
// Why this comparison and not preview-vs-export (T1). The risk T2 introduces
// is a NEW divergence: export keeps decoding through <OffthreadVideo>, so if
// the two preview decoders agree, nothing can have opened between preview and
// export — formally, d(new, export) <= d(new, old) + d(old, export), and a
// measured d(new, old) of ~0 bounds the new gap at the old one whatever the
// old one is. That is a stronger statement than "within tolerance", and it
// does not require building the export leg first.
//
// It does have one limit, and it is the reason T1 still belongs on the plan:
// if the two decoders DISAGREE, this test cannot say which is right. That is
// the escalation trigger — a material delta here means building the export
// leg to adjudicate, and nothing less will do.
//
// Deliberately run on ORIGINALS: the proxies are 8-bit Rec.709 H.264, where
// nothing interesting happens. The DJI files are 10-bit HEVC in D-Log, which
// is where <OffthreadVideo>'s tone mapping and Mediabunny's colour handling
// have the most room to disagree.

import { spawn } from 'child_process';
import electronPath from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const HARNESS = path.join(HERE, 'harness');
const HARNESS_URL = 'http://localhost:5199/';
const CDP_PORT = 9334;
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 'frame-diff');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const out = { fromProject: null, media: 'original', frames: 8, keepOpen: false };
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'from-project') out.fromProject = v;
    else if (k === 'media') out.media = v;
    else if (k === 'frames') out.frames = Number(v);
    else if (k === 'keep-open') out.keepOpen = true;
    else throw new Error(`Unknown flag: --${k}`);
  }
  if (!out.fromProject) throw new Error('--from-project=<studio project id> is required');
  return out;
}

function studioProjectsRoot() {
  return process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
}

async function loadSources({ fromProject, media }) {
  const projectDir = path.join(studioProjectsRoot(), 'projects', fromProject);
  const project = JSON.parse(await fs.readFile(path.join(projectDir, 'project.json'), 'utf8'));
  const sources = [];
  for (const asset of project.assets) {
    if (asset.kind !== 'video') continue;
    const filePath =
      media === 'proxy'
        ? asset.proxy?.status === 'ready'
          ? path.join(projectDir, 'cache', asset.proxy.path)
          : null
        : asset.path;
    if (!filePath || !fsSync.existsSync(filePath)) continue;
    sources.push({
      url: `${HARNESS_URL}asset?path=${encodeURIComponent(filePath)}`,
      durationSec: asset.probe?.duration ?? 10,
      file: filePath,
      codec: asset.probe?.codec ?? '?',
    });
  }
  if (sources.length === 0) throw new Error(`No ${media} video sources in "${fromProject}"`);
  return sources;
}

// ---------------------------------------------------------------------------
// CDP
// ---------------------------------------------------------------------------

async function findTarget(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.url.startsWith(HARNESS_URL));
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error('Bench window never appeared on the debugging port.');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', () => reject(new Error('CDP socket error')));
  });
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message));
    else p.resolve(msg.result);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function waitFor(fn, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(300);
  }
  throw new Error(message);
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  throw new Error(`Harness dev server never came up at ${url}`);
}

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

/**
 * Per-channel deltas between two screenshots.
 *
 * Reports max and mean channel delta plus the share of pixels past a
 * just-noticeable threshold. A mean is not enough on its own: a colour-space
 * error is a small, uniform shift across the whole frame, which a mean shows
 * and a max does not distinguish from one hot pixel of compression noise —
 * and a geometry error is a large delta on a few edges, which is the reverse.
 * Reporting both tells the two apart.
 */
async function diffPng(aPath, bPath) {
  const [a, b] = await Promise.all([
    sharp(aPath).raw().toBuffer({ resolveWithObject: true }),
    sharp(bPath).raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    return { error: `size mismatch ${a.info.width}x${a.info.height} vs ${b.info.width}x${b.info.height}` };
  }
  const ch = a.info.channels;
  const n = a.info.width * a.info.height;
  let max = 0;
  let sum = 0;
  let over2 = 0;
  let over8 = 0;
  // Mean of the signed per-channel shift, kept separately from the magnitude:
  // a tone-mapping difference biases every pixel the same way, so a large mean
  // magnitude with a near-equal signed mean is a systematic colour shift
  // rather than noise.
  let signed = 0;
  for (let i = 0; i < n; i++) {
    let pixelMax = 0;
    for (let c = 0; c < 3; c++) {
      const d = a.data[i * ch + c] - b.data[i * ch + c];
      signed += d;
      const ad = Math.abs(d);
      sum += ad;
      if (ad > pixelMax) pixelMax = ad;
    }
    if (pixelMax > max) max = pixelMax;
    if (pixelMax > 2) over2++;
    if (pixelMax > 8) over8++;
  }
  return {
    width: a.info.width,
    height: a.info.height,
    maxChannelDelta: max,
    meanChannelDelta: Math.round((sum / (n * 3)) * 1000) / 1000,
    signedMeanDelta: Math.round((signed / (n * 3)) * 1000) / 1000,
    pctPixelsOver2: Math.round((over2 / n) * 10000) / 100,
    pctPixelsOver8: Math.round((over8 / n) * 10000) / 100,
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const sources = await loadSources(args);
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log('\nVidTSX frame diff (T2 colour check)');
  console.log(`  project : ${args.fromProject}`);
  console.log(`  media   : ${args.media} — ${sources.length} source(s), codec ${sources[0].codec}`);
  console.log(`  frames  : ${args.frames}\n`);

  const baseConfig = {
    width: 1920,
    height: 1080,
    fps: 30,
    clips: 40,
    layers: 1,
    clipSeconds: 1.2,
    sources: sources.map(({ url, durationSec }) => ({ url, durationSec })),
    mode: 'scrub',
    stepFrames: 1,
    steps: 0,
    warmupSteps: 0,
    settleMs: 2500,
    durationMs: 0,
    mediaLog: true,
  };

  const vite = spawn(
    process.execPath,
    [path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', path.join(HARNESS, 'vite.config.mjs')],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
  );
  vite.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
  await waitForServer(HARNESS_URL);

  const childEnv = { ...process.env, BENCH_URL: HARNESS_URL };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const electron = spawn(
    electronPath,
    [path.join(HERE, 'electron-host.cjs'), `--remote-debugging-port=${CDP_PORT}`],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv },
  );
  electron.stderr.on('data', (d) => process.stderr.write(`[electron] ${d}`));

  let cdp;
  const results = [];
  try {
    const target = await findTarget();
    cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Runtime.enable');
    await waitFor(
      async () => evaluate(cdp, 'Boolean(window.vidtsxBench?.showFrame)'),
      30000,
      'harness never became ready',
    );

    // Frames spread across different clips, so the diff covers several source
    // files and several decode positions rather than one lucky still.
    const frames = Array.from({ length: args.frames }, (_, i) => 7 + i * 41);

    for (const frame of frames) {
      const shots = {};
      for (const engine of ['offthread', 'webcodecs']) {
        const cfg = { ...baseConfig, engine, label: `diff-${engine}` };
        const shown = await evaluate(
          cdp,
          `window.vidtsxBench.showFrame(${JSON.stringify(cfg)}, ${frame})`,
        );
        if (!shown.presented) {
          console.log(`  frame ${String(frame).padStart(4)}  ${engine.padEnd(10)} NOT PRESENTED — skipped`);
          shots[engine] = null;
          continue;
        }
        const clip = shown.rect
          ? { x: Math.round(shown.rect.x), y: Math.round(shown.rect.y), width: Math.round(shown.rect.width), height: Math.round(shown.rect.height), scale: 1 }
          : undefined;
        const { data } = await cdp.send('Page.captureScreenshot', {
          format: 'png',
          ...(clip ? { clip } : {}),
        });
        const file = path.join(OUT_DIR, `f${frame}-${engine}.png`);
        await fs.writeFile(file, Buffer.from(data, 'base64'));
        shots[engine] = { file, mediaTime: shown.mediaTime, via: shown.via };
      }

      if (!shots.offthread || !shots.webcodecs) {
        results.push({ frame, skipped: true });
        continue;
      }
      // Guard: comparing two DIFFERENT source frames would read as a colour
      // difference. Half a source frame at 60 fps is ~8 ms.
      const timeGapMs = Math.abs(shots.offthread.mediaTime - shots.webcodecs.mediaTime) * 1000;
      const diff = await diffPng(shots.offthread.file, shots.webcodecs.file);
      results.push({ frame, timeGapMs: Math.round(timeGapMs * 10) / 10, via: shots.webcodecs.via, ...diff });
      console.log(
        `  frame ${String(frame).padStart(4)}  maxΔ ${String(diff.maxChannelDelta ?? '-').padStart(3)}  meanΔ ${String(diff.meanChannelDelta ?? '-').padStart(6)}  signedΔ ${String(diff.signedMeanDelta ?? '-').padStart(7)}  >2 ${String(diff.pctPixelsOver2 ?? '-').padStart(6)}%  >8 ${String(diff.pctPixelsOver8 ?? '-').padStart(6)}%  (frame gap ${Math.round(timeGapMs)}ms)`,
      );
    }
  } finally {
    cdp?.close();
    if (!args.keepOpen) {
      electron.kill();
      vite.kill();
    }
  }

  const usable = results.filter((r) => !r.skipped && r.maxChannelDelta !== undefined);
  const report = {
    tool: 'frame-diff',
    startedAt: new Date().toISOString(),
    args,
    sources: sources.map((s) => ({ file: path.basename(s.file), codec: s.codec })),
    results,
    summary: usable.length
      ? {
          frames: usable.length,
          worstMaxChannelDelta: Math.max(...usable.map((r) => r.maxChannelDelta)),
          worstMeanChannelDelta: Math.max(...usable.map((r) => r.meanChannelDelta)),
          worstSignedMeanDelta: Math.max(...usable.map((r) => Math.abs(r.signedMeanDelta))),
          worstPctOver8: Math.max(...usable.map((r) => r.pctPixelsOver8)),
        }
      : null,
  };
  const outPath = path.join(OUT_DIR, `${report.startedAt.replace(/[:.]/g, '-')}__${args.media}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  if (report.summary) {
    const s = report.summary;
    console.log(`\n  ${s.frames} frames compared`);
    console.log(`  worst max channel delta   ${s.worstMaxChannelDelta}/255`);
    console.log(`  worst mean channel delta  ${s.worstMeanChannelDelta}/255`);
    console.log(`  worst signed mean delta   ${s.worstSignedMeanDelta}/255  (systematic shift if close to the mean)`);
    console.log(`  worst % pixels over 8     ${s.worstPctOver8}%`);
  } else {
    console.log('\n  no comparable frames — nothing presented on one of the engines');
  }
  console.log(`\nreport: ${path.relative(REPO, outPath)}\n`);
  if (!args.keepOpen) process.exit(0);
}

main().catch((err) => {
  console.error(`\n[frame-diff] ${err.message}\n`);
  process.exit(1);
});
