// Watches a project's cache/ for finished proxies + waveforms; records when each
// lands, captures the first ffmpeg command line seen (the proof of which
// encoder/decoder ran), and writes a JSON report when --expect files exist.
//   node scripts/bench/watch-proxies.mjs --project=t6-stress-3h --expect=44 --out=<file.json>
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const projectDir = path.join(os.homedir(), 'Videos', 'VidTSX Studio', 'projects', args.project);
const proxies = path.join(projectDir, 'cache', 'proxies');
const waveforms = path.join(projectDir, 'cache', 'waveforms');
const expect = Number(args.expect);
const out = args.out;
const started = new Date();
const seen = { proxies: {}, waveforms: {} };
let ffmpegCmd = null;
let ffmpegSeenAt = null;
let maxFfmpeg = 0;

function ps(cmd) {
  return new Promise((resolve) => execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', cmd], { maxBuffer: 1 << 20 }, (_e, so) => resolve(so ?? '')));
}

async function listFinal(dir, ext) {
  try {
    // Final files only: an in-flight window is `<id>.mp4.<pid>.part.mp4` and
    // must not be counted (it was, once — the 44/44 milestone fired early).
    return (await fs.readdir(dir)).filter((f) => f.endsWith(ext) && !/\.part\./.test(f));
  } catch { return []; }
}

console.log(`watching ${projectDir} from ${started.toISOString()} for ${expect} proxies`);
for (;;) {
  const now = new Date().toISOString();
  for (const f of await listFinal(proxies, '.mp4')) if (!seen.proxies[f]) { seen.proxies[f] = now; console.log(`${now} proxy ${Object.keys(seen.proxies).length}/${expect} ${f}`); }
  for (const f of await listFinal(waveforms, '.json')) if (!seen.waveforms[f]) seen.waveforms[f] = now;
  const lines = (await ps("Get-CimInstance Win32_Process -Filter \"Name='ffmpeg.exe'\" | ForEach-Object { $_.ProcessId.ToString() + ' ' + $_.CommandLine }")).trim().split(/\r?\n/).filter(Boolean);
  maxFfmpeg = Math.max(maxFfmpeg, lines.length);
  if (!ffmpegCmd && lines.length) { ffmpegCmd = lines[0]; ffmpegSeenAt = now; console.log(`${now} first ffmpeg: ${ffmpegCmd.slice(0, 400)}`); }
  const nProxy = Object.keys(seen.proxies).length;
  const nWave = Object.keys(seen.waveforms).length;
  if (nProxy >= expect && nWave >= expect && lines.length === 0) {
    const proxyTimes = Object.values(seen.proxies).sort();
    const report = {
      project: args.project, startedAt: started.toISOString(), finishedAt: now,
      firstProxyAt: proxyTimes[0], lastProxyAt: proxyTimes[proxyTimes.length - 1],
      proxies: nProxy, waveforms: nWave, ffmpegFirstSeenAt: ffmpegSeenAt, ffmpegFirstCommand: ffmpegCmd, maxConcurrentFfmpeg: maxFfmpeg,
      proxyBytes: (await Promise.all(Object.keys(seen.proxies).map((f) => fs.stat(path.join(proxies, f)).then((s) => s.size)))).reduce((a, b) => a + b, 0),
      landed: seen,
    };
    await fs.writeFile(out, JSON.stringify(report, null, 2));
    console.log(`done: ${nProxy} proxies, ${(report.proxyBytes / 1048576).toFixed(0)} MB, wrote ${out}`);
    break;
  }
  await new Promise((r) => setTimeout(r, 10000));
}
