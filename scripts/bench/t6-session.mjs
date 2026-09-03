// T6 — a scripted editing session against the open project (docs/PREVIEW_TESTS_PLAN.md §T6).
//   node scripts/bench/t6-session.mjs --minutes=120 --log=<file>
// Needs the dev app running with --remote-debugging-port=9222 and the project open in the editor.
// Every cycle (~100 s): frame-step scrub (ArrowRight ×24), 1 s scrub
// (Shift+ArrowRight ×12), play 8 s, pause, split at playhead (s), undo (Ctrl+Z),
// jump End / Home every 6th cycle, then one random seek by keyboard. Logs one
// JSON line per cycle: wall time, renderer JS heap, rAF interval sanity, the
// player clock, clip count. Uses the same CDP page the drive.mjs helper uses.
const PORT = 9222;
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const minutes = Number(args.minutes ?? 120);
const logFile = args.log;
import fs from 'fs/promises';

async function findPage() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page' && (t.title ?? '').includes('VidTSX') && !t.url.startsWith('devtools'));
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const page = await findPage();
const cdp = connect(page.webSocketDebuggerUrl);
await cdp.ready;
async function evaluate(expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}
async function key(keyName, vk, mods = 0, code = keyName) {
  const text = keyName.length === 1 && mods === 0 ? keyName : undefined;
  await cdp.send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods, text });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: mods });
}
async function keys(k, vk, n, mods = 0, code = k, delay = 60) { for (let i = 0; i < n; i++) { await key(k, vk, mods, code); await sleep(delay); } }
const SHIFT = 8, CTRL = 2;
async function focusTimeline() {
  await evaluate(`(() => { const el = [...document.querySelectorAll('.cursor-grab')].find((e) => e.offsetParent !== null); if (el) { el.scrollIntoView({ block: 'nearest' }); el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })); el.click(); } document.body.focus(); return !!el; })()`);
}
async function snapshot(extra) {
  const s = await evaluate(`(async () => {
    const t0 = performance.now(); let frames = 0;
    await new Promise((res) => { const tick = () => { frames++; if (performance.now() - t0 >= 500) res(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const m = performance.memory ? { usedMB: Math.round(performance.memory.usedJSHeapSize / 1048576), totalMB: Math.round(performance.memory.totalJSHeapSize / 1048576) } : null;
    const clips = [...document.querySelectorAll('.cursor-grab')].filter((e) => e.offsetParent !== null).length;
    const clock = [...document.querySelectorAll('span, div')].map((e) => e.textContent?.trim() ?? '').find((t) => /^\\d\\d:\\d\\d\\.\\d\\d$/.test(t)) ?? null;
    const videos = [...document.querySelectorAll('video')].length;
    return { rafHz: Math.round(frames / ((performance.now() - t0) / 1000)), heap: m, clipsVisible: clips, clock, videos, visibility: document.visibilityState };
  })()`);
  const line = { t: new Date().toISOString(), ...s, ...extra };
  if (logFile) await fs.appendFile(logFile, JSON.stringify(line) + '\n');
  console.log(JSON.stringify(line));
}
const end = Date.now() + minutes * 60 * 1000;
let cycle = 0;
await cdp.send('Page.bringToFront');
await snapshot({ cycle: 0, phase: 'start' });
while (Date.now() < end) {
  cycle++;
  try {
    await focusTimeline();
    await keys('ArrowRight', 39, 24);                 // frame-step scrub
    await keys('ArrowRight', 39, 12, SHIFT);          // 1 s steps
    await key(' ', 32, 0, 'Space'); await sleep(8000); await key(' ', 32, 0, 'Space'); // play 8 s, pause
    await snapshot({ cycle, phase: 'after-play' });
    await key('s', 83);                                // split at playhead
    await sleep(400);
    await key('z', 90, CTRL, 'KeyZ');                  // undo the split
    await sleep(400);
    if (cycle % 6 === 0) { await key('End', 35); await sleep(1500); await keys('ArrowLeft', 37, 10, SHIFT); await sleep(500); await key('Home', 36); await sleep(1500); }
    const jump = 10 + Math.floor(Math.random() * 60);
    await keys('ArrowRight', 39, jump, SHIFT, 'ArrowRight', 30);
    await snapshot({ cycle, phase: 'after-edit', jumpSec: jump });
  } catch (err) {
    const line = { t: new Date().toISOString(), cycle, error: String(err.message ?? err) };
    if (logFile) await fs.appendFile(logFile, JSON.stringify(line) + '\n');
    console.log(JSON.stringify(line));
    await sleep(5000);
  }
  await sleep(60000);
}
await snapshot({ cycle, phase: 'end' });
cdp.close();
