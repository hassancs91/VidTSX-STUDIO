// Wait for the running Studio export to complete and record its outcome.
//   node scripts/bench/export-engine-wait.mjs --out=<file.json>
// Registers a render:complete listener in the page (the engine's finishing
// and verifying phases run outside Remotion's active-render list, so the
// completion event is the only reliable end signal), logs phase messages
// from the queue UI while waiting, then reads the persisted queue row ONLY
// after completion (renderQueueLoad rewrites active rows — never call it
// mid-render).
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
async function evaluate(body, retry = true) {
  try {
    const { result, exceptionDetails } = await Promise.race([
      cdp.send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, returnByValue: true, awaitPromise: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('cdp timeout')), 90000)),
    ]);
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

await evaluate(`if (!window.__exportComplete) { window.__exportComplete = []; window.api.onRenderComplete((d) => window.__exportComplete.push(d)); } return true;`);
const t0 = Date.now();
let lastMsg = '', lastActive = null;
while (Date.now() - t0 < 6 * 3600 * 1000) {
  const done = await evaluate(`return (window.__exportComplete ?? []).filter((d) => !String(d.jobId).includes(':'));`);
  if (done.length) {
    const event = done[done.length - 1];
    log({ step: 'complete', ...event });
    await sleep(2500);
    const active = await evaluate(`const g = await window.api.renderQueueGet(); return (g.jobs ?? []).length;`);
    let persisted = null;
    if (active === 0) {
      persisted = await evaluate(`const r = await window.api.renderQueueLoad(); return (r.jobs ?? []).filter((j) => j.id === ${JSON.stringify(event.jobId)}).map((j) => ({ status: j.status, progress: j.progress, framesRendered: j.framesRendered, totalFrames: j.totalFrames, fileSize: j.fileSize, error: j.error, message: j.message, reportPath: j.reportPath, createdAt: j.createdAt, startedAt: j.startedAt, completedAt: j.completedAt, encoderName: j.encoderName, exportEngine: j.exportEngine, outputPath: j.outputPath }))[0] ?? null;`);
    }
    const final = { event, persisted, waitedMs: Date.now() - t0 };
    log({ step: 'final', ...final });
    if (args.out) await fs.writeFile(args.out, JSON.stringify(final, null, 2));
    break;
  }
  const active = await evaluate(`const g = await window.api.renderQueueGet(); return (g.jobs ?? []).map((j) => ({ id: j.jobId, progress: j.progress }));`);
  const key = JSON.stringify(active);
  if (key !== lastActive) { log({ step: 'active', active }); lastActive = key; }
  const msg = await evaluate(`return [...document.querySelectorAll('*')].filter((e) => e.offsetParent !== null && e.children.length === 0 && /Mixing audio|Writing the file|Verifying|Rendering the reference|Comparing frame|Measuring audio|Finishing|Verified/.test(e.textContent)).map((e) => e.textContent.trim())[0] ?? null;`);
  if (msg && msg !== lastMsg) { log({ step: 'phase', msg, elapsedS: Math.round((Date.now() - t0) / 1000) }); lastMsg = msg; }
  await sleep(5000);
}
cdp.close();
