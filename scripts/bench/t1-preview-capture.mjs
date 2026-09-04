// T1 leg 1 — screenshots of the REAL preview (the Studio Player over proxies)
// at known composition frames (docs/PREVIEW_TESTS_PLAN.md §T1).
//
//   node scripts/bench/t1-preview-capture.mjs --project="T6 stress 3h" --match="1 clips" --frames=30,300,600,870 --label=t1-preview-hevc [--natural]
//
// Needs the dev app on --remote-debugging-port=9222 (docs/ui-automation-cdp.md).
// Opens the project card, finds the Player handle (the PlayerRef object the
// editor keeps in React state — reached by walking the React fiber tree up
// from the <video> element, so no product code changes), seeks to each frame,
// waits for the <video> to actually PRESENT that time (requestVideoFrameCallback,
// the T0 lesson: rAF measures the monitor), then captures the Player's box.
//
// The composition is captured at 1:1 by default: Emulation.setDeviceMetricsOverride
// makes a DPR-1 viewport wide enough that the preview box lays out at the
// composition's own size, so the only resampling in the chain is the one the
// preview really does (the 540p proxy upscaled by Chrome). --natural captures
// at the panel's real on-screen size instead (DPR 1.5 here) — what the user
// literally sees — and the diff resizes the export to match.
//
// Writes <label>-f<N>.png + <label>.json under .vidtsx-temp/bench/t1/preview/.

import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't1', 'preview');
const PORT = 9222;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const frames = (args.frames ?? '30,300,600,870').split(',').map(Number);
const label = args.label ?? 't1-preview';
const natural = 'natural' in args;
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
const cdp = connect((await findPage()).webSocketDebuggerUrl);
await cdp.ready;
const HELPERS = `
  const visible = (sel, root = document) => [...root.querySelectorAll(sel)].filter((el) => el.offsetParent !== null);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The Player handle: usePlayback stores the PlayerRef (seekTo/getCurrentFrame/…)
  // in a useState hook of the editor component; walk up the fiber tree from the
  // preview <video> and look through each fiber's hook list for it.
  const findPlayer = () => {
    if (window.__t1player && typeof window.__t1player.seekTo === 'function') return window.__t1player;
    const video = visible('video')[0];
    if (!video) return null;
    const key = Object.keys(video).find((k) => k.startsWith('__reactFiber$'));
    let fiber = video[key];
    for (let depth = 0; fiber && depth < 200; depth++, fiber = fiber.return) {
      let hook = fiber.memoizedState;
      for (let i = 0; hook && i < 100; i++, hook = hook.next) {
        const v = hook.memoizedState;
        if (v && typeof v === 'object' && typeof v.seekTo === 'function' && typeof v.getCurrentFrame === 'function') { window.__t1player = v; return v; }
      }
    }
    return null;
  };
`;
async function evaluate(body) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate', { expression: `(async () => { ${HELPERS} ${body} })()`, returnByValue: true, awaitPromise: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

// Occlusion kills both requestVideoFrameCallback and Page.captureScreenshot
// (docs/ui-automation-cdp.md): a covered window presents nothing, and the
// second screenshot of the first run hung for 5 min behind the IDE. Maximise
// and foreground the app window at the OS level before touching the Player.
spawnSync('powershell', ['-NoProfile', '-Command', "Add-Type -Name U32 -Namespace W -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h, int n); [DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr h);'; $p = Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*VidTSX*' } | Select-Object -First 1; if ($p) { [W.U32]::ShowWindow($p.MainWindowHandle, 3) | Out-Null; [W.U32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null }"], { stdio: 'ignore' });
await cdp.send('Page.enable');
await cdp.send('Emulation.clearDeviceMetricsOverride');
await cdp.send('Page.bringToFront');
await sleep(800);
await fs.mkdir(OUT_DIR, { recursive: true });

// 1. Studio browser → open the card (same recipe as studio-export.mjs)
await evaluate(`
  const back = visible('button[title="Back to projects"]')[0]; if (back) { back.click(); await sleep(800); }
  const el = visible('*').filter((e) => e.children.length === 0 && e.textContent.trim() === 'Studio')[0];
  let t = el; for (let i = 0; i < 5 && t && t.tagName !== 'BUTTON'; i++) t = t.parentElement;
  for (let attempt = 0; attempt < 3; attempt++) { (t ?? el)?.click(); for (let i = 0; i < 100; i++) { await sleep(100); if (visible('.cursor-pointer').filter((x) => x.querySelector('.truncate')).length > 0) return; } }`);
const open = await evaluate(`
  const name = ${JSON.stringify(args.project)}; const match = ${JSON.stringify(args.match ?? '')};
  const card = visible('.cursor-pointer').filter((el) => el.querySelector('.truncate')).find((el) => el.textContent.includes(name) && (!match || el.textContent.includes(match)));
  if (!card) return { error: 'no card' };
  card.click();
  for (let i = 0; i < 1200; i++) { await sleep(50); if (visible('button[title="Back to projects"]')[0] && visible('.cursor-grab').length > 0) break; }
  for (let i = 0; i < 200; i++) { await sleep(100); if (visible('video')[0]) break; }
  window.__t1player = null;
  const p = findPlayer();
  const v = visible('video')[0];
  return { player: Boolean(p), videoSrc: v?.currentSrc ?? null, dpr: window.devicePixelRatio, inner: [innerWidth, innerHeight] };`);
log({ step: 'open', ...open });
if (open.error || !open.player) { console.error('cannot drive the Player'); process.exit(1); }
// Proxy still building? (status text) — wait, the preview must be the proxy.
for (let i = 0; i < 240; i++) {
  const building = await evaluate(`return [...document.querySelectorAll('span, div')].some((e) => e.offsetParent !== null && e.children.length === 0 && /Building \\d+ preview prox/.test(e.textContent));`);
  if (!building) break;
  await sleep(5000);
}

// 2. Lay the composition out at 1:1 (unless --natural)
let emulated = null;
if (!natural) {
  // Grow the viewport until the video box is >= the composition width.
  const comp = await evaluate(`const v = visible('video')[0]; return { w: v.videoWidth, h: v.videoHeight, box: v.getBoundingClientRect().toJSON() };`);
  log({ step: 'natural-box', ...comp });
  // The preview box scales with the panel, i.e. linearly with the viewport
  // width; converge on a box of exactly the composition's width (±1 px).
  let width = 2600;
  for (let i = 0; i < 6; i++) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: Math.round(width * 0.62), deviceScaleFactor: 1, mobile: false });
    await sleep(700);
    const box = await evaluate(`const v = visible('video')[0]; return v.getBoundingClientRect().toJSON();`);
    emulated = { width, height: Math.round(width * 0.62), box };
    if (box.width >= 1920 && box.width <= 1921.5) break;
    width = Math.round((width * 1920.6) / box.width);
  }
  log({ step: 'emulated', ...emulated });
}

// 3. Seek, wait for presentation, capture
const rows = [];
for (const f of frames) {
  const shown = await evaluate(`
    const p = findPlayer(); const v = visible('video')[0];
    const fps = 30; const target = ${f} / fps;
    // Arm the presentation callback BEFORE seeking so the seek's own frame is caught.
    const presented = new Promise((res) => {
      const deadline = performance.now() + 8000;
      const cb = (now, meta) => { if (Math.abs(meta.mediaTime - target) < 0.02 || performance.now() > deadline) res({ mediaTime: meta.mediaTime, presentedFrames: meta.presentedFrames, w: meta.width, h: meta.height, via: 'rvfc' }); else v.requestVideoFrameCallback(cb); };
      v.requestVideoFrameCallback(cb);
      setTimeout(() => res({ mediaTime: v.currentTime, via: 'timeout' }), 9000);
    });
    p.seekTo(${f});
    const r = await presented;
    await sleep(400); // let the compositor paint the presented frame
    const rect = v.getBoundingClientRect().toJSON();
    return { ...r, playerFrame: p.getCurrentFrame(), currentTime: v.currentTime, seeking: v.seeking, readyState: v.readyState, src: v.currentSrc, rect, visibility: document.visibilityState };`);
  // Exactly the composition size: the box is laid out at >= 1920 (converged above) and the clip starts at its rounded origin.
  const clip = natural
    ? { x: Math.round(shown.rect.x), y: Math.round(shown.rect.y), width: Math.round(shown.rect.width), height: Math.round(shown.rect.height), scale: 1 }
    : { x: Math.round(shown.rect.x), y: Math.round(shown.rect.y), width: 1920, height: 1080, scale: 1 };
  log({ step: 'presented', frame: f, via: shown.via, mediaTime: shown.mediaTime });
  const { data } = await Promise.race([cdp.send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: !natural, fromSurface: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('screenshot timeout')), 30000))]);
  const file = path.join(OUT_DIR, `${label}-f${f}.png`);
  await fs.writeFile(file, Buffer.from(data, 'base64'));
  const row = { frame: f, target: f / 30, ...shown, clip, file };
  rows.push(row);
  log({ step: 'captured', frame: f, mediaTime: shown.mediaTime, via: shown.via, playerFrame: shown.playerFrame, currentTime: shown.currentTime, rect: shown.rect });
}
if (!natural) await cdp.send('Emulation.clearDeviceMetricsOverride');
await fs.writeFile(path.join(OUT_DIR, `${label}.json`), JSON.stringify({ label, project: args.project, natural, emulated, open, rows, at: new Date().toISOString() }, null, 2));
cdp.close();
