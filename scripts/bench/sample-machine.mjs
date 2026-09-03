// T6 — machine sampler (docs/PREVIEW_TESTS_PLAN.md §T6).
//
//   node scripts/bench/sample-machine.mjs --label=t6-proxy-x264 --interval=30
//
// Every --interval seconds, appends one JSON line to
// .vidtsx-temp/bench/samples/<stamp>__<label>.jsonl with:
//   - per-process working set / private bytes for every electron.exe whose
//     command line points at this repo (the dev app: main + renderer + GPU +
//     utility processes, tagged by --type), plus every ffmpeg.exe;
//   - machine-wide available MB, committed GB, CPU load %, and the Windows
//     GPU Engine VideoDecode / VideoEncode utilisation summed per adapter
//     LUID (the same counter T4/T4b used — proof, not inference);
//   - bytes written to the project's cache/ folder if --cache-dir is given.
// Ctrl+C (or SIGTERM) stops it and prints min/max/last of the key columns.
//
// Why a separate sampler rather than the app's own telemetry: the question
// T6 asks is what the whole machine does over hours, not what one process
// thinks of itself. Working set is what the OS charges; private bytes is
// what the process asked for; the gap is shared/mapped memory.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 'samples');

function parseArgs(argv) {
  const out = { label: 'sample', interval: 30, cacheDir: null, match: 'VidTSX-STUDIO' };
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'label') out.label = v;
    else if (k === 'interval') out.interval = Number(v);
    else if (k === 'cache-dir') out.cacheDir = v;
    else if (k === 'match') out.match = v;
    else throw new Error(`Unknown flag: --${k}`);
  }
  return out;
}

// One PowerShell child, one JSON line per sample: spawning powershell per tick
// costs ~1 s of CPU each, which would show up in its own measurement.
function makeProbeScript(match) {
  return `
$ErrorActionPreference = 'SilentlyContinue'
function Sample {
  $procs = Get-CimInstance Win32_Process -Filter "Name='electron.exe' OR Name='ffmpeg.exe' OR Name='ffprobe.exe' OR Name='chrome-headless-shell.exe' OR Name='remotion.exe'" |
    Where-Object { $_.Name -ne 'electron.exe' -or ($_.CommandLine -and $_.CommandLine -like '*${match.replace(/'/g, "''")}*') }
  $rows = @()
  foreach ($p in $procs) {
    $pp = Get-Process -Id $p.ProcessId
    if (-not $pp) { continue }
    $type = 'main'
    if ($p.CommandLine -match '--type=([a-z-]+)') { $type = $matches[1] }
    if ($p.Name -ne 'electron.exe') { $type = $p.Name }
    $rows += [pscustomobject]@{ pid=$p.ProcessId; type=$type; ws=[math]::Round($pp.WorkingSet64/1MB); priv=[math]::Round($pp.PrivateMemorySize64/1MB); cpu=[math]::Round($pp.CPU,1) }
  }
  $os = Get-CimInstance Win32_OperatingSystem
  $load = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average
  $dec = @{}; $enc = @{}
  $ctr = Get-Counter '\\GPU Engine(*engtype_VideoDecode)\\Utilization Percentage','\\GPU Engine(*engtype_VideoEncode)\\Utilization Percentage' -ErrorAction SilentlyContinue
  foreach ($c in $ctr.CounterSamples) {
    if ($c.InstanceName -match 'luid_0x[0-9a-f]+_0x([0-9a-f]+)_phys') {
      if ($c.Path -like '*VideoDecode*') { $dec[$matches[1]] += $c.CookedValue } else { $enc[$matches[1]] += $c.CookedValue }
    }
  }
  $d = @{}; foreach ($k in $dec.Keys) { $d[$k] = [math]::Round($dec[$k],1) }
  $e = @{}; foreach ($k in $enc.Keys) { $e[$k] = [math]::Round($enc[$k],1) }
  $commit = (Get-Counter '\\Memory\\Committed Bytes').CounterSamples[0].CookedValue / 1GB
  [pscustomobject]@{
    t = (Get-Date).ToUniversalTime().ToString('o')
    availMB = [math]::Round($os.FreePhysicalMemory/1KB)
    commitGB = [math]::Round($commit, 2)
    cpuLoad = $load
    gpuDecode = $d
    gpuEncode = $e
    procs = $rows
  } | ConvertTo-Json -Compress -Depth 4
}
while ($true) {
  $line = [string]::Empty
  try { $line = Sample } catch { $line = '{"error":"' + $_.ToString().Replace('"','') + '"}' }
  [Console]::Out.WriteLine($line)
  $sig = [Console]::In.ReadLine()
  if ($sig -eq 'quit') { break }
}
`;
}

async function dirBytes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else { try { total += (await fs.stat(p)).size; } catch { /* mid-write */ } }
    }
  }
  return total;
}

async function main() {
  const args = parseArgs(process.argv);
  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `${stamp}__${args.label}.jsonl`);
  const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', makeProbeScript(args.match)], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  let buf = '';
  const lines = [];
  let resolveNext = null;
  ps.stdout.on('data', (d) => {
    buf += d.toString();
    const parts = buf.split(/\r?\n/);
    buf = parts.pop();
    for (const l of parts) {
      if (!l.trim()) continue;
      lines.push(l);
      if (resolveNext) { const r = resolveNext; resolveNext = null; r(); }
    }
  });
  const nextLine = () => new Promise((resolve) => { if (lines.length) resolve(); else resolveNext = resolve; });

  const stats = { availMin: Infinity, mainMax: 0, rendererMax: 0, totalMax: 0, samples: 0, ffmpegMax: 0 };
  let stopping = false;
  const stop = () => { stopping = true; };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  console.log(`Sampling every ${args.interval}s → ${outFile}`);

  while (!stopping) {
    await nextLine();
    const raw = lines.shift();
    let sample;
    try { sample = JSON.parse(raw); } catch { sample = { error: 'unparseable', raw }; }
    if (args.cacheDir) sample.cacheBytes = await dirBytes(args.cacheDir);
    const procs = Array.isArray(sample.procs) ? sample.procs : sample.procs ? [sample.procs] : [];
    const main = procs.filter((p) => p.type === 'main').reduce((a, p) => a + p.ws, 0);
    const renderer = procs.filter((p) => p.type === 'renderer').reduce((a, p) => a + p.ws, 0);
    const total = procs.filter((p) => !/ffmpeg|ffprobe|chrome|remotion/.test(p.type)).reduce((a, p) => a + p.ws, 0);
    const ffmpeg = procs.filter((p) => /ffmpeg/.test(p.type)).length;
    // Remotion's export browser (chrome-headless-shell, one per render) and its
    // compositor (remotion.exe, OffthreadVideo frame extraction) are reported
    // on their own so an export's peak is not folded into the app's.
    const browser = procs.filter((p) => /chrome|remotion/.test(p.type)).reduce((a, p) => a + p.ws, 0);
    sample.summary = { mainWS: main, rendererWS: renderer, appWS: total, ffmpegProcs: ffmpeg, browserWS: browser };
    stats.samples++;
    stats.availMin = Math.min(stats.availMin, sample.availMB ?? Infinity);
    stats.mainMax = Math.max(stats.mainMax, main);
    stats.rendererMax = Math.max(stats.rendererMax, renderer);
    stats.totalMax = Math.max(stats.totalMax, total);
    stats.ffmpegMax = Math.max(stats.ffmpegMax, ffmpeg);
    await fs.appendFile(outFile, JSON.stringify(sample) + '\n');
    const gd = sample.gpuDecode ? Object.entries(sample.gpuDecode).map(([k, v]) => `${k}:${v}`).join(',') : '-';
    const ge = sample.gpuEncode ? Object.entries(sample.gpuEncode).map(([k, v]) => `${k}:${v}`).join(',') : '-';
    console.log(
      `${sample.t}  avail ${sample.availMB} MB  commit ${sample.commitGB} GB  cpu ${sample.cpuLoad}%  ` +
      `main ${main} MB  renderer ${renderer} MB  app ${total} MB  browser ${browser} MB  ffmpeg×${ffmpeg}  dec[${gd}] enc[${ge}]` +
      (args.cacheDir ? `  cache ${Math.round(sample.cacheBytes / 1048576)} MB` : ''),
    );
    const deadline = Date.now() + args.interval * 1000;
    while (!stopping && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 250));
      // Windows has no clean SIGTERM for a detached node: a `<file>.stop`
      // marker next to the output is the stop signal.
      if (fsSync.existsSync(outFile + '.stop')) { stopping = true; await fs.rm(outFile + '.stop', { force: true }); }
    }
    if (!stopping) ps.stdin.write('next\n');
  }
  try { ps.stdin.write('quit\n'); } catch { /* gone */ }
  ps.kill();
  console.log(`\nStopped after ${stats.samples} samples → ${outFile}`);
  console.log(`  avail min ${stats.availMin} MB · main WS max ${stats.mainMax} MB · renderer WS max ${stats.rendererMax} MB · app WS max ${stats.totalMax} MB · ffmpeg max ${stats.ffmpegMax}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
