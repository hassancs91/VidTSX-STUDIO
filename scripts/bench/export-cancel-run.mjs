// Export-engines Stage 4 — start one Studio export through the REAL UI, cancel it
// from the queue row at a chosen moment, and report what the cancel left behind:
// the export's scratch folder, Remotion's %TEMP% asset copies, headless browsers,
// the half-written output file, and what the queue row persisted.
//   node scripts/bench/export-cancel-run.mjs --project="<card title>" --engine=passthrough \
//        (--cancel-after=<seconds after the first progress tick> | --cancel-when=browser|finishing) --out=<file.json>
// Needs the dev app running with --remote-debugging-port=9222 (docs/ui-automation-cdp.md).
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
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
const page = await findPage();
const cdp = connect(page.webSocketDebuggerUrl);
await cdp.ready;
const HELPERS = `
  const visible = (sel, root = document) => [...root.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
  const byText = (text, sel = 'button') => visible(sel).filter((el) => el.textContent.trim() === text).sort((a, b) => a.textContent.length - b.textContent.length)[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
`;
async function evaluate(body) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${HELPERS} ${body} })()`, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

// What the machine holds before the export: Remotion asset folders, our scratch folders, headless browsers.
const TEMP = os.tmpdir();
const scratchRoot = path.join(TEMP, 'vidtsx-studio', 'export');
const listDirs = (root, re) => fsSync.existsSync(root) ? fsSync.readdirSync(root).filter((n) => re.test(n)) : [];
const browsers = () => {
  try {
    return execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf-8' }).split('\n').map((l) => l.split('","')[0]?.replace(/^"/, '')).filter((n) => /chrome|headless/i.test(n ?? '')).length;
  } catch { return -1; }
};
const snapshot = () => ({ remotionAssetDirs: listDirs(TEMP, /^remotion-v.*-assets/), scratchDirs: listDirs(scratchRoot, /./), browsers: browsers() });
const before = snapshot();
log({ step: 'before', ...before });

await cdp.send('Page.bringToFront');
await evaluate(`localStorage.removeItem('vidtsx:export-verify'); return true;`);
// A previous cancel run leaves the app on the Queue screen with the project still open behind it:
// go to the Studio screen FIRST (its Back button is hidden until then), then back to the cards.
const nav = await evaluate(`
  const studioNav = () => { const el = visible('*').filter((e) => e.children.length === 0 && e.textContent.trim() === 'Studio')[0]; let t = el; for (let i = 0; i < 5 && t && t.tagName !== 'BUTTON'; i++) t = t.parentElement; return t ?? el; };
  for (let attempt = 0; attempt < 3; attempt++) {
    studioNav()?.click(); await sleep(800);
    const back = visible('button[title="Back to projects"]')[0]; if (back) { back.click(); await sleep(800); }
    for (let i = 0; i < 100; i++) { await sleep(100); const n = visible('.cursor-pointer').filter((x) => x.querySelector('.truncate')).length; if (n > 0) return n; }
  }
  return 0;`);
log({ step: 'browser', cards: nav });
const open = await evaluate(`
  const name = ${JSON.stringify(args.project)};
  const cards = visible('.cursor-pointer').filter((el) => el.querySelector('.truncate'));
  const titles = (el) => [...el.querySelectorAll('.truncate')].map((t) => t.textContent.trim());
  const card = cards.find((el) => titles(el).some((t) => t === name)) ?? cards.find((el) => titles(el).some((t) => t.startsWith(name + ' (')));
  if (!card) return { error: 'no card' };
  card.click();
  for (let i = 0; i < 1200; i++) { await sleep(50); if (visible('button[title="Back to projects"]')[0] && visible('.cursor-grab').length > 0) return { ok: true }; }
  return { error: 'open timeout' };`);
log({ step: 'open', ...open });
if (open.error) process.exit(1);
for (let i = 0; i < Number(args['proxy-wait'] ?? 20) * 12; i++) {
  const building = await evaluate(`return [...document.querySelectorAll('span, div')].some((e) => e.offsetParent !== null && e.children.length === 0 && /Building \\d+ preview prox/.test(e.textContent));`);
  if (!building && i > 2) break;
  await sleep(5000);
}
const dialog = await evaluate(`
  const b = byText('Export'); if (!b) return { error: 'no Export button' };
  b.click();
  for (let i = 0; i < 100; i++) { await sleep(100); if (visible('[data-export-dialog]')[0]) break; }
  for (let i = 0; i < 100; i++) { await sleep(100); if (visible('[data-export-engine]').length > 0) break; }
  const engine = ${JSON.stringify(args.engine ?? '')};
  if (engine) { const row = visible('[data-export-engine="' + engine + '"]')[0]; if (!row) return { error: 'engine row missing: ' + engine }; row.querySelector('input').click(); await sleep(100); }
  return { engines: visible('[data-export-engine]').map((el) => ({ id: el.dataset.exportEngine, checked: el.querySelector('input').checked })) };`);
log({ step: 'dialog', ...dialog });
if (dialog.error) process.exit(1);
await evaluate(`
  window.__exportComplete = []; window.__exportProgress = null;
  window.api.onRenderComplete((d) => window.__exportComplete.push({ ...d, at: Date.now() }));
  window.api.onRenderProgress((p) => { if (!String(p.jobId).includes(':')) window.__exportProgress = { ...p, at: Date.now() }; });
  return true;`);
const clickT = Date.now();
const confirmed = await evaluate(`const b = visible('[data-export-confirm]')[0]; if (!b) return 'no confirm'; b.click(); await sleep(1500); return visible('[data-export-dialog]').length ? 'dialog still open' : 'queued';`);
log({ step: 'confirm', confirmed });

// Wait for the moment to cancel.
const after = Number(args['cancel-after'] ?? 0);
const when = args['cancel-when'] ?? '';
let firstTick = null, lastMsg = '', jobId = null, tick = null;
while (Date.now() - clickT < 2 * 3600 * 1000) {
  await sleep(1000);
  tick = await evaluate(`return window.__exportProgress;`);
  if (!tick) continue;
  jobId = tick.jobId;
  if (firstTick === null && tick.phase === 'rendering') firstTick = Date.now();
  const msg = `${tick.phase} ${tick.percent}% ${tick.framesRendered ?? ''}/${tick.totalFrames ?? ''} ${tick.message ?? ''}`;
  if (msg !== lastMsg) { log({ step: 'progress', msg }); lastMsg = msg; }
  if (when === 'browser' && /rendering \d+ of \d+ spans/.test(tick.message ?? '')) break;
  if (when === 'finishing' && tick.phase === 'finishing') break;
  if (!when && firstTick !== null && Date.now() - firstTick >= after * 1000) break;
}
const during = snapshot();
log({ step: 'during', ...during, tick });

// The queue row's Cancel: exactly one rendering row exists; print what matched before clicking.
const cancel = await evaluate(`
  // The sidebar's Queue button carries its badge count BEFORE the label ("2Queue").
  const q = visible('button').find((b) => /^\\d*Queue$/.test(b.textContent.trim())); if (!q) return { error: 'no Queue nav button' };
  q.click(); await sleep(1000);
  const buttons = visible('button').filter((b) => b.textContent.trim() === 'Cancel');
  const rows = buttons.map((b) => { let r = b; for (let i = 0; i < 6 && r && !r.className.includes('border-b'); i++) r = r.parentElement; return r ? r.textContent.trim().slice(0, 120) : ''; });
  if (buttons.length !== 1) return { error: 'expected exactly one Cancel button', rows };
  buttons[0].click();
  return { clicked: rows[0] };`);
log({ step: 'cancel', ...cancel, at: new Date().toISOString() });
if (cancel.error) process.exit(1);

// Wait for the export's completion event, then a settling period.
let event = null;
for (let i = 0; i < 120; i++) {
  await sleep(1000);
  const done = await evaluate(`return (window.__exportComplete ?? []).filter((d) => !String(d.jobId).includes(':'));`);
  if (done.length) { event = done[done.length - 1]; break; }
}
log({ step: 'complete-event', event });
await sleep(Number(args['settle'] ?? 20) * 1000);
const persisted = await evaluate(`const r = await window.api.renderQueueLoad(); return (r.jobs ?? []).filter((j) => j.id === ${JSON.stringify(jobId)}).map((j) => ({ status: j.status, progress: j.progress, framesRendered: j.framesRendered, totalFrames: j.totalFrames, error: j.error, outputPath: j.outputPath, completedAt: j.completedAt }))[0] ?? null;`);
const afterSnap = snapshot();
const scratchLeft = jobId ? fsSync.existsSync(path.join(scratchRoot, jobId)) : null;
const outputLeft = persisted?.outputPath ? fsSync.existsSync(persisted.outputPath) : null;
const newRemotionDirs = afterSnap.remotionAssetDirs.filter((d) => !before.remotionAssetDirs.includes(d));
const newScratch = afterSnap.scratchDirs.filter((d) => !before.scratchDirs.includes(d));
const final = { jobId, persisted, scratchLeft, outputLeft, newRemotionDirs, newScratch, browsersBefore: before.browsers, browsersDuring: during.browsers, browsersAfter: afterSnap.browsers };
log({ step: 'final', ...final });
if (args.out) await fs.writeFile(args.out, JSON.stringify({ project: args.project, engine: args.engine ?? null, cancelAfter: after, cancelWhen: when, before, during, tick, cancel, event, final }, null, 2));
cdp.close();
