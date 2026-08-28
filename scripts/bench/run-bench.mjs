// T0 — the preview scrub benchmark.
//
//   node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=proxy
//   node scripts/bench/run-bench.mjs --from-project=raw-footage-test --media=original --runs=3
//
// Starts the harness dev server, opens it in Electron (same Chromium as the
// app), drives `window.vidtsxBench.run()` over CDP for each scenario, and
// writes a JSON report next to a printed summary.
//
// Why this exists: before it, the only scrub number in the project was one
// figure in a code comment (57 ms/step). Every "is it faster now?" was a
// feeling. Nothing about the decoder, the proxy codec or the scale ceiling can
// be decided without a repeatable measurement, so this is the instrument the
// other tests are built on — and a regression guard afterwards.

import { spawn } from 'child_process';
import electronPath from 'electron';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const HARNESS = path.join(HERE, 'harness');
const HARNESS_URL = 'http://localhost:5199/';
const CDP_PORT = 9333;
const NL = String.fromCharCode(10);
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    fromProject: null,
    media: 'proxy',
    runs: 3,
    clips: 40,
    layers: 1,
    only: null,
    keepOpen: false,
    label: null,
    clipSeconds: 1.2,
    engine: 'offthread',
    mediaLog: true,
  };
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'from-project') out.fromProject = v;
    else if (k === 'media') out.media = v;
    else if (k === 'runs') out.runs = Number(v);
    else if (k === 'clips') out.clips = Number(v);
    else if (k === 'layers') out.layers = Number(v);
    else if (k === 'only') out.only = v;
    else if (k === 'label') out.label = v;
    else if (k === 'clip-seconds') out.clipSeconds = Number(v);
    else if (k === 'engine') out.engine = v;
    else if (k === 'media-log') out.mediaLog = v !== 'off' && v !== 'false';
    else if (k === 'keep-open') out.keepOpen = true;
    else throw new Error(`Unknown flag: --${k}`);
  }
  if (!out.fromProject) throw new Error('--from-project=<studio project id> is required');
  if (out.media !== 'proxy' && out.media !== 'original') {
    throw new Error('--media must be "proxy" or "original"');
  }
  if (out.engine !== 'offthread' && out.engine !== 'webcodecs') {
    throw new Error('--engine must be "offthread" (shipping) or "webcodecs" (@remotion/media, T2)');
  }
  return out;
}

// ---------------------------------------------------------------------------
// sources: read a real Studio project so the bench runs on real media
// ---------------------------------------------------------------------------

function studioProjectsRoot() {
  // Mirrors getDefaultStudioProjectsRoot(); an overridden root is passed via env.
  return process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
}

async function loadSources({ fromProject, media }) {
  const projectDir = path.join(studioProjectsRoot(), 'projects', fromProject);
  const file = path.join(projectDir, 'project.json');
  if (!fsSync.existsSync(file)) throw new Error(`No project.json at ${file}`);
  const project = JSON.parse(await fs.readFile(file, 'utf8'));

  const sources = [];
  for (const asset of project.assets) {
    if (asset.kind !== 'video') continue;
    let filePath;
    if (media === 'proxy') {
      if (asset.proxy?.status !== 'ready') continue;
      filePath = path.join(projectDir, 'cache', asset.proxy.path);
    } else {
      filePath = asset.path;
    }
    if (!fsSync.existsSync(filePath)) continue;
    sources.push({
      url: `${HARNESS_URL}asset?path=${encodeURIComponent(filePath)}`,
      durationSec: asset.probe?.duration ?? 10,
      file: filePath,
      codec: asset.probe?.codec ?? '?',
      dims: `${asset.probe?.width ?? '?'}x${asset.probe?.height ?? '?'}`,
    });
  }
  if (sources.length === 0) {
    throw new Error(
      media === 'proxy'
        ? `No ready proxies in "${fromProject}" — open it in the app once and let them finish.`
        : `No original video files found for "${fromProject}".`,
    );
  }
  return sources;
}

// ---------------------------------------------------------------------------
// scenarios
// ---------------------------------------------------------------------------

/**
 * Scrub speeds are named after how the S2 checkpoint in Status.md described
 * them, so today's numbers stay comparable with the ones already on file.
 */
function buildScenarios({ sources, clips, layers, engine, mediaLog, clipSeconds }) {
  const base = {
    width: 1920,
    height: 1080,
    fps: 30,
    clips,
    layers,
    clipSeconds,
    sources: sources.map(({ url, durationSec }) => ({ url, durationSec })),
    warmupSteps: 20,
    settleMs: 1500,
    steps: 150,
    durationMs: 0,
    mode: 'scrub',
    stepFrames: 1,
    engine,
    mediaLog,
  };
  return [
    { ...base, label: 'scrub-natural', stepFrames: 1 },
    { ...base, label: 'scrub-fling', stepFrames: 15 },
    { ...base, label: 'playback', mode: 'playback', durationMs: 5000, steps: 0 },
  ];
}

// ---------------------------------------------------------------------------
// tiny CDP client (no puppeteer — Node's global fetch + WebSocket is enough)
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
      /* debugger not up yet */
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
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

function pct(sorted, p) {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}

function summarise(values) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return {
    n: values.length,
    p50: round(pct(sorted, 50)),
    p90: round(pct(sorted, 90)),
    p99: round(pct(sorted, 99)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
    mean: round(mean),
    // A step slower than 100 ms reads as a visible hitch rather than sluggishness.
    stalls: values.filter((v) => v > 100).length,
  };
}

const round = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const sources = await loadSources(args);

  console.log(`\nVidTSX preview bench (T0)`);
  console.log(`  project : ${args.fromProject}`);
  console.log(`  media   : ${args.media} — ${sources.length} source(s)`);
  console.log(
    `  engine  : ${args.engine}${args.engine === 'webcodecs' ? ' (@remotion/media — EXPERIMENTAL, T2)' : ' (shipping <OffthreadVideo>)'}` +
      `${args.engine === 'webcodecs' && !args.mediaLog ? '  [control: canvas tap DISARMED]' : ''}`,
  );
  for (const s of sources.slice(0, 6)) {
    // `dims`/`codec` describe the SOURCE asset; in proxy mode the file being
    // decoded is the 720p transcode of it, which is the point of the tier.
    console.log(`            ${path.basename(s.file)}  source ${s.dims} ${s.codec}  ${s.durationSec.toFixed(1)}s`);
  }
  console.log(`  fixture : ${args.clips} clips × ${args.layers} layer(s), runs=${args.runs}\n`);

  const scenarios = buildScenarios({
    sources,
    clips: args.clips,
    layers: args.layers,
    engine: args.engine,
    mediaLog: args.mediaLog,
    clipSeconds: args.clipSeconds,
  }).filter((s) => !args.only || s.label === args.only);

  // Spawn vite's JS entry with this Node, not the `vite.cmd` shim: Node >= 20
  // refuses to spawn .cmd/.bat without a shell (EINVAL), and going through a
  // shell would only add quoting problems on Windows paths with spaces.
  const vite = spawn(
    process.execPath,
    [path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js'), '--config', path.join(HARNESS, 'vite.config.mjs')],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
  );
  vite.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));

  await waitForServer(HARNESS_URL);

  // ELECTRON_RUN_AS_NODE is inherited from the parent process and makes
  // Electron boot as a bare Node runtime with no window at all. Clearing it is
  // not optional (docs/ui-automation-cdp.md).
  const childEnv = { ...process.env, BENCH_URL: HARNESS_URL };
  delete childEnv.ELECTRON_RUN_AS_NODE;

  // `import electronPath from 'electron'` resolves to the real .exe, avoiding
  // the .cmd shim for the same reason as above.
  const electron = spawn(
    electronPath,
    [path.join(HERE, 'electron-host.cjs'), `--remote-debugging-port=${CDP_PORT}`],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'], env: childEnv },
  );
  electron.stderr.on('data', (d) => process.stderr.write(`[electron] ${d}`));

  let cdp;
  const report = {
    tool: 'preview-bench',
    version: 1,
    startedAt: new Date().toISOString(),
    machine: {
      platform: `${os.platform()} ${os.release()}`,
      cpu: os.cpus()[0]?.model ?? 'unknown',
      cores: os.cpus().length,
      memGb: Math.round(os.totalmem() / 1073741824),
    },
    git: await gitSha(),
    args,
    sources: sources.map(({ file, dims, codec, durationSec }) => ({
      file: path.basename(file),
      dims,
      codec,
      durationSec: round(durationSec),
    })),
    scenarios: [],
  };

  try {
    const target = await findTarget();
    cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Runtime.enable');

    await waitFor(async () => evaluate(cdp, 'Boolean(window.vidtsxBench?.ready)'), 30000, 'harness never became ready');

    for (const scenario of scenarios) {
      const runs = [];
      for (let r = 0; r < args.runs; r++) {
        process.stdout.write(`  ${scenario.label} run ${r + 1}/${args.runs} … `);
        const cfg = { ...scenario, label: `${scenario.label}#${r}` };
        const raw = await evaluate(cdp, `window.vidtsxBench.run(${JSON.stringify(cfg)})`);
        const frame = summarise(raw.frameMs);
        const seek = summarise(raw.seekMs);
        const raf = summarise(raw.rafMs);
        runs.push({
          frame,
          seek,
          raf,
          err: summarise(raw.frameErrMs),
          misses: raw.misses ?? 0,
          freebies: raw.freebies ?? 0,
          warmup: summarise(raw.warmupFrameMs),
          heapMb: raw.heapMb,
          notes: raw.notes ?? [],
          presentedVia: raw.presentedVia ?? null,
          decoders: raw.decoders ?? null,
          elements: raw.elements ?? null,
          canvasDraws: raw.canvasDraws ?? 0,
        });
        if (cfg.mode === 'playback') {
          // Presented-frame gaps, not rAF gaps: a frozen picture still ticks rAF.
          console.log(
            frame
              ? `presented ${round(1000 / frame.p50)} fps (gap p50 ${frame.p50}ms, p90 ${frame.p90}ms)`
              : 'NO VIDEO FRAMES PRESENTED',
          );
        } else {
          console.log(
            frame
              ? `p50 ${frame.p50}ms  p90 ${frame.p90}ms  miss ${raw.misses}  cached ${raw.freebies}`
              : 'no samples',
          );
        }
      }
      report.scenarios.push({ label: scenario.label, config: scenario, runs, summary: acrossRuns(runs) });
    }
  } finally {
    cdp?.close();
    if (!args.keepOpen) {
      electron.kill();
      vite.kill();
    }
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const name = `${stamp}__${args.fromProject}__${args.media}${args.label ? `__${args.label}` : ''}.json`;
  const outPath = path.join(OUT_DIR, name);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));

  printTable(report);
  printDecoderSection(report);
  console.log(`\nreport: ${path.relative(REPO, outPath)}\n`);
  if (!args.keepOpen) process.exit(0);
}

/** Median-of-runs plus the spread, because single runs swing ±10 ms on a busy machine. */
function acrossRuns(runs) {
  const p50s = runs.map((r) => r.frame?.p50).filter((v) => v != null);
  const p90s = runs.map((r) => r.frame?.p90).filter((v) => v != null);
  const seeks = runs.map((r) => r.seek?.p50).filter((v) => v != null);
  const rafs = runs.map((r) => r.raf?.p50).filter((v) => v != null);
  if (p50s.length === 0) {
    return rafs.length ? { rafP50: median(rafs), playbackFps: round(1000 / median(rafs)) } : null;
  }
  return {
    p50: median(p50s),
    p50Range: [Math.min(...p50s), Math.max(...p50s)],
    p90: median(p90s),
    seekP50: seeks.length ? median(seeks) : null,
    rafP50: rafs.length ? median(rafs) : null,
    stepsPerSec: round(1000 / median(p50s)),
    stalls: runs.reduce((a, r) => a + (r.frame?.stalls ?? 0), 0),
    misses: runs.reduce((a, r) => a + (r.misses ?? 0), 0),
    freebies: runs.reduce((a, r) => a + (r.freebies ?? 0), 0),
    // Median presentation error: how far the frame that appeared was from the
    // frame that was asked for. This is the frame-accuracy half of the test.
    errP50: median(runs.map((r) => r.err?.p50).filter((v) => v != null)),
  };
}

function printTable(report) {
  console.log('\n  scenario         p50 frame      spread        p90   steps/s  JS/step     err   miss  cached');
  console.log('  ' + '-'.repeat(92));
  for (const s of report.scenarios) {
    const m = s.summary;
    if (!m) {
      console.log(`  ${s.label.padEnd(16)} (no samples)`);
      continue;
    }
    if (s.config?.mode === 'playback') {
      const fps = m.p50 ? round(1000 / m.p50) : 0;
      console.log(
        `  ${s.label.padEnd(16)} presented ${String(fps).padStart(5)} fps  (frame gap p50 ${round(m.p50)}ms, p90 ${round(m.p90)}ms)`,
      );
      continue;
    }
    if (m.p50 == null) {
      console.log(`  ${s.label.padEnd(16)} (no presented frames)`);
      continue;
    }
    const spread = `${round(m.p50Range[0])}–${round(m.p50Range[1])}`;
    console.log(
      `  ${s.label.padEnd(16)} ${String(round(m.p50)).padStart(7)}ms ${spread.padStart(13)} ${String(round(m.p90)).padStart(7)}ms ${String(m.stepsPerSec).padStart(9)} ${String(m.seekP50 ?? '-').padStart(6)}ms ${String(round(m.errP50) ?? '-').padStart(6)}ms ${String(m.misses).padStart(6)} ${String(m.freebies).padStart(7)}`,
    );
  }
  console.log(
    '\n  p50 frame = ms from asking for a frame to that frame being PRESENTED\n' +
    '  (requestVideoFrameCallback) — NOT the animation-frame cadence, which reports\n' +
    "  a flawless 16.7 ms on a timeline that visibly lags. JS/step is the app's own\n" +
    '  synchronous cost: small JS + large p50 = decode-bound, the hypothesis T2 tests.\n' +
    '  err = |presented − requested|, the frame-accuracy half. miss = nothing matching\n' +
    '  within 400 ms. cached = the frame was already on screen (no decode needed).',
  );
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  throw new Error(`Harness dev server never came up at ${url}`);
}

async function waitFor(fn, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await sleep(300);
  }
  throw new Error(message);
}

async function gitSha() {
  return new Promise((resolve) => {
    const p = spawn('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => resolve(out.trim() || null));
    p.on('error', () => resolve(null));
  });
}

/**
 * The T2 half of the report: which decoder actually ran.
 *
 * A speed number is meaningless without it. `@remotion/media` silently falls
 * back to <OffthreadVideo> per clip for anything it cannot decode, so a
 * "webcodecs" run that quietly fell back would otherwise be reported as the
 * new decoder performing exactly like the old one — a true statement about the
 * numbers and a completely false one about the cause.
 */
function printDecoderSection(report) {
  if (report.args.engine !== 'webcodecs') return;
  const runs = report.scenarios.flatMap((s) => s.runs);
  const via = runs.reduce(
    (a, r) => ({
      video: a.video + (r.presentedVia?.video ?? 0),
      canvas: a.canvas + (r.presentedVia?.canvas ?? 0),
    }),
    { video: 0, canvas: 0 },
  );
  const decoders = runs.map((r) => r.decoders).filter(Boolean);
  const created = decoders.reduce((a, d) => a + d.created, 0);
  const maxOpen = decoders.reduce((a, d) => Math.max(a, d.open), 0);
  const codecs = [...new Set(decoders.flatMap((d) => d.configured))];
  const checks = [];
  for (const d of decoders) {
    for (const c of d.supportChecks) {
      if (!checks.some((x) => x.codec === c.codec && x.supported === c.supported)) checks.push(c);
    }
  }
  const errors = [...new Set(decoders.flatMap((d) => d.errors))];
  const els = runs.map((r) => r.elements).filter(Boolean);

  console.log(NL + '  decoder path');
  console.log('  ' + '-'.repeat(92));
  const total = via.video + via.canvas;
  const pctCanvas = total ? Math.round((via.canvas / total) * 100) : 0;
  console.log(
    `  presented via      canvas (WebCodecs) ${via.canvas}   video (OffthreadVideo fallback) ${via.video}   -> ${pctCanvas}% WebCodecs`,
  );
  console.log(`  VideoDecoders      created ${created}, max concurrently open ${maxOpen}`);
  if (codecs.length) console.log(`  codecs configured  ${codecs.join(', ')}`);
  for (const c of checks) {
    console.log(`  isConfigSupported  ${c.codec} -> ${c.supported ? 'SUPPORTED' : 'NOT SUPPORTED (falls back)'}`);
  }
  if (els.length) {
    console.log(
      `  elements mounted   <video> max ${Math.max(...els.map((e) => e.videos))}, <canvas> max ${Math.max(...els.map((e) => e.canvases))}`,
    );
  }
  for (const e of errors) console.log(`  decoder error      ${e}`);
  if (via.canvas === 0 && via.video > 0) {
    console.log(NL + '  ** FULL FALLBACK: nothing decoded through WebCodecs. The numbers above');
    console.log('     describe <OffthreadVideo>, not @remotion/media. **');
  }
}

main().catch((err) => {
  console.error(`\n[bench] ${err.message}\n`);
  process.exit(1);
});
