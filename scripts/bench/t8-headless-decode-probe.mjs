// T8a — can Remotion's headless Chromium decode our sources with WebCodecs at
// all, and with hardware? (docs/PREVIEW_TESTS_PLAN.md §T8)
//
//   node scripts/bench/t8-headless-decode-probe.mjs --gl=swangle
//   node scripts/bench/t8-headless-decode-probe.mjs --gl=angle
//   node scripts/bench/t8-headless-decode-probe.mjs --gl=angle --extra=--enable-features=PlatformHEVCDecoderSupport
//
// Launches the SAME chrome-headless-shell binary Remotion's renderer uses
// (node_modules/.remotion/…) with the same --use-gl/--use-angle flags
// open-browser.js maps each `gl` option to, opens about:blank over CDP and
// asks VideoDecoder.isConfigSupported for HEVC Main10 4K (the DJI clips),
// H.264 High 4K (the video-2 master) and AV1, each with prefer-hardware and
// prefer-software. A "no" here means <Video> from @remotion/media falls back
// to <OffthreadVideo> in that configuration before a single frame is drawn —
// the answer to T8a without a 13-minute render.

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const SHELL = path.join(REPO, 'node_modules', '.remotion', 'chrome-headless-shell', 'win64', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
const PORT = 9345;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));

// Mirrors @remotion/renderer/dist/open-browser.js getGlRenderer().
function glFlags(gl) {
  if (gl === 'swangle') return ['--use-gl=angle', '--use-angle=swiftshader'];
  if (gl === 'angle-egl') return ['--use-gl=angle', '--use-angle=gl-egl'];
  if (gl === 'vulkan') return ['--use-angle=vulkan', '--enable-features=Vulkan', '--disable-vulkan-fallback-to-gl-for-testing', '--enable-unsafe-webgpu', '--disable-vulkan-surface'];
  if (!gl) return [];
  return [`--use-gl=${gl}`];
}

const gl = args.gl ?? 'swangle';
const flags = [
  `--remote-debugging-port=${PORT}`,
  '--no-first-run', '--disable-web-security', '--no-sandbox', '--hide-scrollbars',
  ...glFlags(gl),
  ...(args.extra ? args.extra.split(' ') : []),
  'about:blank',
];
const child = spawn(SHELL, flags, { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (d) => { stderr += d; });

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`headless shell never exposed a page target\n${stderr}`);
}

const PROBE = `(async () => {
  const codecs = [
    ['hevc main10 4k', 'hev1.2.4.L153.B0', 3840, 2160],
    ['h264 high 4k', 'avc1.640033', 3840, 2160],
    ['av1 main 4k', 'av01.0.08M.08', 3840, 2160],
    ['vp9 4k', 'vp09.00.40.08', 3840, 2160],
  ];
  const out = { url: location.href, isSecureContext, userAgent: navigator.userAgent, hasVideoDecoder: typeof VideoDecoder !== 'undefined', results: {} };
  if (!out.hasVideoDecoder) return out;
  for (const [name, codec, w, h] of codecs) {
    for (const ha of ['prefer-hardware', 'prefer-software', 'no-preference']) {
      try {
        const r = await VideoDecoder.isConfigSupported({ codec, codedWidth: w, codedHeight: h, hardwareAcceleration: ha });
        out.results[name + ' / ' + ha] = r.supported;
      } catch (e) { out.results[name + ' / ' + ha] = 'error: ' + e.message; }
    }
  }
  const c = document.createElement('canvas');
  const glc = c.getContext('webgl2');
  if (glc) { const dbg = glc.getExtension('WEBGL_debug_renderer_info'); out.webglRenderer = dbg ? glc.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : glc.getParameter(glc.RENDERER); }
  return out;
})()`;

try {
  const page = await findTarget();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  const pending = new Map();
  let nextId = 1;
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = nextId++; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  // WebCodecs is [SecureContext]-only: about:blank in the headless shell is
  // NOT one (VideoDecoder is undefined there), while Remotion's render page is
  // served from http://localhost:<port>, which is. Navigate to a loopback URL
  // first — the dev app's asset server by default — so the probe sees what a
  // render page sees.
  const url = args.url ?? 'http://127.0.0.1:3100/';
  await send('Page.enable');
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 1500));
  const result = await send('Runtime.evaluate', { expression: PROBE, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify({ gl, flags: flags.slice(1, -1), ...(result.result?.value ?? result) }, null, 2));
  ws.close();
} finally {
  child.kill();
}
