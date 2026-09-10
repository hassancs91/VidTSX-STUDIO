// Export-engines Stage 1 — drive one Studio export through the REAL UI (the
// Export button → the engine dialog → confirm) and record the queue's outcome.
//   node scripts/bench/export-engine-run.mjs --project="t5-1080p" [--engine=remotion] [--verify=remotion] [--range] --out=<file.json>
// Needs the dev app running with --remote-debugging-port=9222 (docs/ui-automation-cdp.md).
// --verify sets the hidden localStorage flag (vidtsx:export-verify) before
// opening the dialog, ticks the dev checkbox and picks the reference engine.
// A screenshot of the open dialog lands beside --out. Polling follows
// studio-export.mjs: renderQueueGet while active (never renderQueueLoad),
// then the persisted queue row + history after the job leaves the list.
import fs from 'fs/promises';
const PORT = 9222;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (o) => console.log(JSON.stringify({ t: new Date().toISOString(), ...o }));

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
async function screenshot(file) {
  try {
    await cdp.send('Page.enable');
    const { data } = await sendWithTimeout('Page.captureScreenshot', { format: 'png' }, 20000);
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    log({ step: 'screenshot', file });
  } catch (err) {
    log({ step: 'screenshot-failed', reason: String(err.message ?? err) });
  }
}

await cdp.send('Page.bringToFront');
if (args.verify) await evaluate(`localStorage.setItem('vidtsx:export-verify', '1'); return true;`);
else await evaluate(`localStorage.removeItem('vidtsx:export-verify'); return true;`);

// 1. Studio project browser
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
  const name = ${JSON.stringify(args.project)};
  const cards = visible('.cursor-pointer').filter((el) => el.querySelector('.truncate'));
  const titles = (el) => [...el.querySelectorAll('.truncate')].map((t) => t.textContent.trim());
  // Exact title, then "<name> (…)" (the T1 cards carry a parenthesised note; "T1 cut" must not match "T1 cut 3s"), then loose.
  const card = cards.find((el) => titles(el).some((t) => t === name))
    ?? cards.find((el) => titles(el).some((t) => t.startsWith(name + ' (')))
    ?? cards.find((el) => el.textContent.includes(name + ' ') || el.textContent.trim().endsWith(name));
  if (!card) return { error: 'no card' };
  const t0 = performance.now(); card.click();
  for (let i = 0; i < 1200; i++) { await sleep(50); if (visible('button[title="Back to projects"]')[0] && visible('.cursor-grab').length > 0) return { openMs: Math.round(performance.now() - t0) }; }
  return { error: 'open timeout' };`);
log({ step: 'open', ...open });
if (open.error) process.exit(1);
// 3. wait for proxies (--proxy-wait=<minutes>, default 20 — a seeded 3 h project builds 44 of them)
for (let i = 0; i < Number(args['proxy-wait'] ?? 20) * 12; i++) {
  const building = await evaluate(`return [...document.querySelectorAll('span, div')].some((e) => e.offsetParent !== null && e.children.length === 0 && /Building \\d+ preview prox/.test(e.textContent));`);
  if (!building && i > 2) break;
  await sleep(5000);
}
log({ step: 'proxy-ready' });
// 4. Export → dialog
const clickT = Date.now();
const dialog = await evaluate(`
  const b = byText(${JSON.stringify(args.range ? 'Export range' : 'Export')}); if (!b) return { error: 'no Export button' };
  b.click();
  for (let i = 0; i < 100; i++) { await sleep(100); if (visible('[data-export-dialog]')[0]) break; }
  const dlg = visible('[data-export-dialog]')[0]; if (!dlg) return { error: 'no dialog' };
  for (let i = 0; i < 100; i++) { await sleep(100); if (visible('[data-export-engine]').length > 0) break; }
  const engines = visible('[data-export-engine]').map((el) => ({ id: el.dataset.exportEngine, checked: el.querySelector('input').checked, disabled: el.querySelector('input').disabled, text: el.textContent.trim() }));
  const engine = ${JSON.stringify(args.engine ?? '')};
  if (engine) { const row = visible('[data-export-engine="' + engine + '"]')[0]; if (!row) return { error: 'engine row missing: ' + engine, engines }; row.querySelector('input').click(); await sleep(100); }
  const verify = ${JSON.stringify(args.verify ?? '')};
  let verifyBox = visible('[data-export-verify]').length;
  if (verify) {
    const box = visible('[data-export-verify]')[0]; if (!box) return { error: 'verify controls missing', engines };
    box.querySelector('input[type=checkbox]').click(); await sleep(150);
    const sel = box.querySelector('select'); if (!sel) return { error: 'verify select missing' };
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; setter.call(sel, verify); sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(100);
  }
  const title = visible('h2, h3, [class*="title"]').map((e) => e.textContent.trim()).find((t) => t === 'Export' || t === 'Export range');
  return { engines, verifyBox, title, confirm: visible('[data-export-confirm]')[0]?.textContent.trim() };`);
log({ step: 'dialog', ...dialog });
if (dialog.error) process.exit(1);
if (args.out) await screenshot(args.out.replace(/\.json$/, '-dialog.png'));
await evaluate(`if (!window.__exportComplete) { window.__exportComplete = []; window.api.onRenderComplete((d) => window.__exportComplete.push({ ...d, at: Date.now() })); } return true;`);
// The progress events themselves (Stage 4: the engine's copied/rendering line + the frame counts the row persists).
await evaluate(`if (!window.__exportProgressHook) { window.__exportProgressHook = true; window.__exportProgress = null; window.api.onRenderProgress((p) => { if (!String(p.jobId).includes(':')) window.__exportProgress = { ...p, at: Date.now() }; }); } return true;`);
const confirmed = await evaluate(`const b = visible('[data-export-confirm]')[0]; if (!b) return 'no confirm'; b.click(); await sleep(1500); return visible('[data-export-dialog]').length ? 'dialog still open' : 'queued';`);
log({ step: 'confirm', confirmed });
// 5. wait for the completion event (the finishing/verifying phases run outside
// Remotion's active list, so render:complete is the only reliable end signal),
// then read the persisted row — renderQueueLoad only once nothing is active.
let final = null, seen = null, lastProgress = -1, lastPhaseMsg = '', lastTick = '', startedAt = null;
while (Date.now() - clickT < 6 * 3600 * 1000) {
  await sleep(5000);
  const done = await evaluate(`return (window.__exportComplete ?? []).filter((d) => !String(d.jobId).includes(':') && d.at > ${clickT});`);
  if (done.length) {
    const event = done[done.length - 1];
    const finishedAt = Date.now();
    await sleep(2500);
    const activeNow = await evaluate(`const g = await window.api.renderQueueGet(); return (g.jobs ?? []).length;`);
    const persisted = activeNow === 0 ? await evaluate(`const r = await window.api.renderQueueLoad(); return (r.jobs ?? []).filter((j) => j.id === ${JSON.stringify(event.jobId)}).map((j) => ({ status: j.status, progress: j.progress, framesRendered: j.framesRendered, totalFrames: j.totalFrames, fileSize: j.fileSize, error: j.error, message: j.message, reportPath: j.reportPath, createdAt: j.createdAt, startedAt: j.startedAt, completedAt: j.completedAt, encoderName: j.encoderName, exportEngine: j.exportEngine, outputPath: j.outputPath }))[0] ?? null;`) : null;
    final = { jobId: event.jobId, event, clickedAt: new Date(clickT).toISOString(), renderStartedAt: startedAt ? new Date(startedAt).toISOString() : null, finishedAt: new Date(finishedAt).toISOString(), wallMsFromClick: finishedAt - clickT, wallMsFromStart: startedAt ? finishedAt - startedAt : null, persisted };
    break;
  }
  const tick = await evaluate(`return window.__exportProgress;`);
  if (tick && tick.at > clickT) {
    const line = `${tick.phase} ${tick.percent}% ${tick.framesRendered ?? '-'}/${tick.totalFrames ?? '-'} ${tick.message ?? ''}`;
    if (line !== lastTick) { log({ step: 'progress', line, elapsedS: Math.round((Date.now() - clickT) / 1000) }); lastTick = line; }
  }
  const active = await evaluate(`const g = await window.api.renderQueueGet(); return g.jobs ?? [];`);
  const mine = active.find((j) => !String(j.jobId).includes(':'));
  if (mine) {
    if (!seen) { seen = mine; startedAt = Date.now(); log({ step: 'render-started', ...mine, sinceClickMs: startedAt - clickT }); }
    if (mine.progress !== lastProgress) { log({ step: 'poll', status: mine.status, progress: mine.progress, elapsedS: Math.round((Date.now() - startedAt) / 1000) }); lastProgress = mine.progress; }
    continue;
  }
  // Also the passthrough engine's Stage 4 progress line ("Copied 41 % · rendering 1 of 1 spans · about 4 min left").
  const msg = await evaluate(`return [...document.querySelectorAll('*')].filter((e) => e.offsetParent !== null && e.children.length === 0 && /Mixing audio|Writing the file|Verifying|Rendering the reference|Comparing frame|Measuring audio|Finishing|Copied \\d+ %|Nothing on this timeline/.test(e.textContent)).map((e) => e.textContent.trim())[0] ?? null;`);
  if (msg && msg !== lastPhaseMsg) { log({ step: 'phase', msg, elapsedS: Math.round((Date.now() - clickT) / 1000) }); lastPhaseMsg = msg; }
}
log({ step: 'final', ...final });
if (args.out) await fs.writeFile(args.out, JSON.stringify({ project: args.project, engine: args.engine ?? null, verify: args.verify ?? null, open, dialog, final }, null, 2));
cdp.close();
