// T5/T6 — drive one Studio export through the real UI and time it from the
// app's own render-queue records.
//   node scripts/bench/studio-export.mjs --project="T6 stress 0.01h" --match="7680×4320" --out=<file.json> [--skip-proxy-wait]
//   node scripts/bench/studio-export.mjs --project="T6 stress 3h" --id=t6-stress-3h --direct-cpu=2 --out=<file.json>
// Needs the dev app running with --remote-debugging-port=9222 (docs/ui-automation-cdp.md).
// open the project card whose text contains --project (and --match, to pick
// among same-named cards, e.g. the width label "7680×4320"), wait until the
// per-asset proxy job has finished (the export uses originals, but a proxy
// ffmpeg running alongside would confound wall time and memory), click
// Export, then poll window.api.renderQueueLoad() every 5 s until the newest
// job is done / error / cancelled. One JSON line per poll to stdout; the final
// record goes to --out.
import fs from 'fs/promises';
const PORT = 9222;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page' && (t.title ?? '').includes('VidTSX') && !t.url.startsWith('devtools'));
      if (page) return page;
    } catch {}
    await sleep(1000);
  }
  throw new Error('no page');
}
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  return { ready, send(method, params = {}) { const id = nextId++; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); }); }, close: () => ws.close() };
}
// The dev page reloads itself now and then (Vite client reconnect / dep
// re-optimisation), which closes the CDP socket mid-await. Reconnect and
// retry once rather than dying with an unsettled top-level await.
let cdp = null;
async function reconnect() {
  try { cdp?.close(); } catch {}
  const page = await findPage();
  cdp = connect(page.webSocketDebuggerUrl);
  await cdp.ready;
}
await reconnect();
const HELPERS = `
  const visible = (sel, root = document) => [...root.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
  const byText = (text, sel = 'button') => visible(sel).filter((el) => el.textContent.trim() === text).sort((a, b) => a.textContent.length - b.textContent.length)[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
`;
function sendWithTimeout(method, params, ms) {
  return Promise.race([cdp.send(method, params), new Promise((_, rej) => setTimeout(() => rej(new Error('cdp timeout')), ms))]);
}
async function evaluate(body, retry = true) {
  try {
    const { result, exceptionDetails } = await sendWithTimeout('Runtime.evaluate', { expression: `(async () => { ${HELPERS} ${body} })()`, returnByValue: true, awaitPromise: true }, 90000);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  } catch (err) {
    if (!retry) throw err;
    log({ step: 'reconnect', reason: String(err.message ?? err) });
    await sleep(3000);
    await reconnect();
    return evaluate(body, false);
  }
}
const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));

await cdp.send('Page.bringToFront');
// 1. to the Studio project browser
const nav = await evaluate(`
  const back = visible('button[title="Back to projects"]')[0]; if (back) { back.click(); await sleep(800); }
  const el = visible('*').filter((e) => e.children.length === 0 && e.textContent.trim() === 'Studio')[0];
  let t = el; for (let i = 0; i < 5 && t && t.tagName !== 'BUTTON'; i++) t = t.parentElement;
  for (let attempt = 0; attempt < 3; attempt++) {
    (t ?? el)?.click();
    for (let i = 0; i < 100; i++) { await sleep(100); const n = visible('.cursor-pointer').filter((x) => x.querySelector('.truncate')).length; if (n > 0) return n; }
  }
  return 0;`);
log({ step: 'browser', cards: nav });
// 2. open the card
const open = await evaluate(`
  const name = ${JSON.stringify(args.project)}; const match = ${JSON.stringify(args.match ?? '')};
  const card = visible('.cursor-pointer').filter((el) => el.querySelector('.truncate')).find((el) => el.textContent.includes(name) && (!match || el.textContent.includes(match)));
  if (!card) return { error: 'no card' };
  const t0 = performance.now(); card.click();
  for (let i = 0; i < 1200; i++) { await sleep(50); if (visible('button[title="Back to projects"]')[0] && visible('.cursor-grab').length > 0) return { openMs: Math.round(performance.now() - t0) }; }
  return { error: 'open timeout' };`);
log({ step: 'open', ...open });
if (open.error) process.exit(1);
// 3. wait for the proxy job (status text "Building N preview proxies…")
if (!('skip-proxy-wait' in args)) {
  for (let i = 0; i < 240; i++) {
    const building = await evaluate(`return [...document.querySelectorAll('span, div')].some((e) => e.offsetParent !== null && e.children.length === 0 && /Building \\d+ preview prox/.test(e.textContent));`);
    if (!building && i > 2) break;
    await sleep(5000);
  }
  log({ step: 'proxy-ready' });
}
// 4. click Export
// NOTE: never call window.api.renderQueueLoad() while a render is active — it
// is the startup-recovery path and rewrites every 'rendering' row in the DB
// to error "Render was interrupted when the app closed" (measured: it did).
// Active renders are read from renderQueueGet() (main-process truth); the
// outcome from the render history plus the persisted queue AFTER it ends.
const histBefore = await evaluate(`const h = await window.api.renderHistoryLoad(); return (h.entries ?? []).map((e) => e.outputPath);`);
const clickT = Date.now();
let clicked;
if (args['direct-cpu'] !== undefined || args['direct-scale'] !== undefined) {
  // The export IPC path: the same studioExportPrepare + renderStart the Export
  // button issues, but with an explicit concurrency (`cpuUsage`, passed
  // verbatim to Remotion's `concurrency`) and/or `scale`. The Export button
  // itself passes neither, so the Settings › Rendering CPU default does not
  // reach Studio exports (measured 2026-09-03).
  clicked = await evaluate(`
    const id = ${JSON.stringify(args.id ?? '')};
    const loaded = await window.api.studioProjectLoad({ id });
    if (!loaded.success) return 'load failed: ' + loaded.error;
    const prepared = await window.api.studioExportPrepare({ project: loaded.project });
    if (!prepared.success) return 'prepare failed: ' + prepared.error;
    const dir = await window.api.renderGetVideosDir();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputPath = (dir.path ?? dir.videosDir ?? dir) + '/' + prepared.compositionId + '_' + stamp + '-direct.mp4';
    const cpu = ${JSON.stringify(args['direct-cpu'] ?? null)};
    const res = await window.api.renderStart({
      filePath: prepared.entryPath, compositionId: prepared.compositionId, outputPath, codec: 'h264',
      width: prepared.width, height: prepared.height, fps: prepared.fps,
      ...(cpu !== null && cpu !== '' ? { cpuUsage: /^\\d+$/.test(cpu) ? Number(cpu) : cpu } : {}),
      ...(${JSON.stringify(args['direct-scale'] ?? null)} ? { scale: Number(${JSON.stringify(args['direct-scale'] ?? '1')}) } : {}),
    });
    return JSON.stringify({ res, outputPath, width: prepared.width, height: prepared.height, frames: prepared.durationInFrames });`);
} else {
  clicked = await evaluate(`const b = byText('Export'); if (!b) return 'no Export button'; b.click(); await sleep(500); return 'clicked';`);
}
log({ step: 'export-click', clicked });
// 5. poll active renders
let final = null;
let seen = null;
let lastProgress = -1;
let startedAt = null;
while (Date.now() - clickT < 12 * 3600 * 1000) {
  await sleep(5000);
  const active = await evaluate(`const g = await window.api.renderQueueGet(); return g.jobs ?? [];`);
  const mine = active.find((j) => !seen || j.jobId === seen.jobId) ?? active[0];
  if (mine) {
    if (!seen) { seen = mine; startedAt = Date.now(); log({ step: 'render-started', ...mine, sinceClickMs: startedAt - clickT }); }
    if (mine.progress !== lastProgress) { log({ step: 'poll', status: mine.status, progress: mine.progress, elapsedS: Math.round((Date.now() - startedAt) / 1000) }); lastProgress = mine.progress; }
    continue;
  }
  if (!seen) { if (Date.now() - clickT > 20 * 60 * 1000) { log({ step: 'poll', note: 'no render appeared in 20 min' }); break; } continue; }
  // gone from the active list → finished or failed
  const finishedAt = Date.now();
  await sleep(2000);
  const hist = await evaluate(`const h = await window.api.renderHistoryLoad(); return (h.entries ?? []).filter((e) => e.outputPath === ${JSON.stringify(seen.outputPath)});`);
  const persisted = await evaluate(`const r = await window.api.renderQueueLoad(); return (r.jobs ?? []).filter((j) => j.id === ${JSON.stringify(seen.jobId)}).map((j) => ({ status: j.status, progress: j.progress, framesRendered: j.framesRendered, totalFrames: j.totalFrames, fileSize: j.fileSize, error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, completedAt: j.completedAt, encoderName: j.encoderName, encoderHardwareAccelerated: j.encoderHardwareAccelerated, width: j.width, height: j.height, scale: j.scale }));`);
  final = { jobId: seen.jobId, outputPath: seen.outputPath, compositionId: seen.compositionId, clickedAt: new Date(clickT).toISOString(), renderStartedAt: new Date(startedAt).toISOString(), finishedAt: new Date(finishedAt).toISOString(), wallMsFromClick: finishedAt - clickT, wallMsFromStart: finishedAt - startedAt, history: hist[0] ?? null, persisted: persisted[0] ?? null };
  break;
}
log({ step: 'final', ...final });
if (args.out) await fs.writeFile(args.out, JSON.stringify({ project: args.project, match: args.match, open, final }, null, 2));
cdp.close();
