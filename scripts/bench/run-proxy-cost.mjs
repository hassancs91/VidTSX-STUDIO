// T4 — proxy generation cost.
//
//   node scripts/bench/run-proxy-cost.mjs --from-project=raw-footage-test
//   node scripts/bench/run-proxy-cost.mjs --file="C:\path\master.mp4" --variants=sw,d3d11va
//
// Runs the SAME transcode the app runs (proxy-generator.ts: 720p, libx264
// veryfast, CRF 26, GOP 15, AAC 128k) over every video asset of a Studio
// project, `--concurrency` files at a time, once per decode variant, and times
// it. Nothing about the output is used afterwards — this measures cost only.
//
// What each variant changes is only the INPUT side of the command:
//   sw        software decode (what ships)
//   d3d11va   -hwaccel d3d11va on the default adapter — frames are decoded on
//             the GPU and downloaded to system memory, because `scale` needs
//             them there. -hwaccel_output_format is deliberately NOT set.
//   d3d11va1  same on adapter index 1 (hybrid laptops: index 0 is usually the
//             iGPU, 1 the discrete card)
//   dxva2     the older API, for comparison
//
// Numbers recorded per file: wall seconds, ffmpeg's own `-benchmark` line
// (utime/stime = CPU seconds the process actually consumed, which is the
// honest "how much CPU did this cost" number), realtime factor, output bytes,
// and whether the hwaccel actually engaged (ffmpeg silently falls back to
// software when it cannot — a run that "used d3d11va" and quietly did not
// would report software numbers under a hardware label).
//
// Reports land in .vidtsx-temp/bench/ next to the T0 ones.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench');
const FFMPEG = path.join(REPO, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe');

const VARIANTS = {
  sw: [],
  d3d11va: ['-hwaccel', 'd3d11va'],
  d3d11va1: ['-hwaccel', 'd3d11va', '-hwaccel_device', '1'],
  dxva2: ['-hwaccel', 'dxva2'],
};

function parseArgs(argv) {
  const out = {
    fromProject: null,
    files: [],
    variants: ['sw', 'd3d11va'],
    concurrency: 2,
    limitSeconds: 0,
    label: null,
    priority: 'normal',
    gop: 15,
    height: 720,
    crf: 26,
    codec: 'x264',
    q: 5,
    out: null,
  };
  for (const arg of argv.slice(2)) {
    const i = arg.indexOf('=');
    const k = (i === -1 ? arg : arg.slice(0, i)).replace(/^--/, '');
    const v = i === -1 ? '' : arg.slice(i + 1);
    if (k === 'from-project') out.fromProject = v;
    else if (k === 'file') out.files.push(v);
    else if (k === 'variants') out.variants = v.split(',');
    else if (k === 'concurrency') out.concurrency = Number(v);
    else if (k === 'limit-seconds') out.limitSeconds = Number(v);
    else if (k === 'label') out.label = v;
    else if (k === 'priority') out.priority = v;
    else if (k === 'gop') out.gop = Number(v);
    else if (k === 'height') out.height = Number(v);
    else if (k === 'crf') out.crf = Number(v);
    else if (k === 'codec') out.codec = v;
    else if (k === 'q') out.q = Number(v);
    else if (k === 'out') out.out = v;
    else throw new Error(`Unknown flag: --${k}`);
  }
  for (const v of out.variants) {
    if (!VARIANTS[v]) throw new Error(`Unknown variant ${v}; known: ${Object.keys(VARIANTS).join(',')}`);
  }
  if (!out.fromProject && out.files.length === 0) throw new Error('--from-project=<id> or --file=<path> required');
  return out;
}

function studioProjectsRoot() {
  return process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
}

async function loadFiles(args) {
  const files = [...args.files];
  if (args.fromProject) {
    const file = path.join(studioProjectsRoot(), 'projects', args.fromProject, 'project.json');
    const project = JSON.parse(await fs.readFile(file, 'utf8'));
    for (const a of project.assets) {
      if (a.kind === 'video' && fsSync.existsSync(a.path)) files.push({ path: a.path, assetId: a.id });
    }
  }
  const out = [];
  for (const f of files) {
    const file = typeof f === 'string' ? f : f.path;
    const st = await fs.stat(file);
    out.push({ file, assetId: typeof f === 'string' ? null : f.assetId, bytes: st.size, ...(await probe(file)) });
  }
  return out;
}

async function probe(file) {
  const ffprobe = FFMPEG.replace(/ffmpeg\.exe$/, 'ffprobe.exe');
  const json = await new Promise((resolve, reject) => {
    const p = spawn(ffprobe, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', file]);
    let s = '';
    p.stdout.on('data', (d) => (s += d));
    p.on('close', (c) => (c === 0 ? resolve(JSON.parse(s)) : reject(new Error(`ffprobe ${c}`))));
  });
  const v = json.streams.find((s) => s.codec_type === 'video');
  return {
    durationSec: Number(json.format.duration),
    codec: v?.codec_name,
    pixFmt: v?.pix_fmt,
    dims: `${v?.width}x${v?.height}`,
    fps: v?.r_frame_rate,
  };
}

/** Mirrors proxy-generator.ts's command exactly, plus the variant's input args and -benchmark. */
function proxyArgs(variantArgs, source, output, args) {
  return [
    '-hide_banner', '-nostdin', '-loglevel', 'verbose', '-benchmark',
    ...variantArgs,
    '-i', source,
    ...(args.limitSeconds ? ['-t', String(args.limitSeconds)] : []),
    '-vf', `scale=-2:min(${args.height}\\,ih)`,
    ...(args.codec === 'mjpeg'
      ? ['-c:v', 'mjpeg', '-q:v', String(args.q), '-pix_fmt', 'yuvj420p']
      : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(args.crf), '-g', String(args.gop), '-pix_fmt', 'yuv420p']),
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-y', output,
  ];
}

function runOne(variant, src, output, args) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const proc = spawn(FFMPEG, proxyArgs(VARIANTS[variant], src.file, output, args), {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    if (args.priority === 'below-normal') os.setPriority(proc.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('error', reject);
    proc.on('close', async (code) => {
      const wallSec = Number(process.hrtime.bigint() - t0) / 1e9;
      if (code !== 0) return reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-1500)}`));
      const bench = /bench: utime=([\d.]+)s stime=([\d.]+)s rtime=([\d.]+)s/.exec(stderr);
      const hwLines = stderr
        .split(/\r?\n/)
        .filter((l) => /hwaccel|d3d11|dxva/i.test(l))
        .map((l) => l.trim())
        .slice(0, 8);
      // ffmpeg only logs a line when an explicit hwaccel FAILS ("Failed setup
      // for format …"), then silently continues in software. Absence of that
      // line is necessary but not sufficient; the GPU decode counter sampled
      // by gpuSampler() is the proof.
      const setupFailed = /Failed setup for format/i.test(stderr);
      const outBytes = (await fs.stat(output)).size;
      const sourceSec = args.limitSeconds ? Math.min(args.limitSeconds, src.durationSec) : src.durationSec;
      resolve({
        file: path.basename(src.file),
        wallSec: r(wallSec),
        cpuSec: bench ? r(Number(bench[1]) + Number(bench[2])) : null,
        utime: bench ? Number(bench[1]) : null,
        stime: bench ? Number(bench[2]) : null,
        sourceSec,
        realtimeX: r(sourceSec / wallSec),
        outMb: r(outBytes / 1048576),
        hwaccelSetupFailed: variant === 'sw' ? null : setupFailed,
        hwLines,
      });
    });
  });
}

/** Average machine-wide busy % while a variant runs, sampled from os.cpus(). */
function cpuSampler() {
  const snap = () => os.cpus().map((c) => c.times);
  let last = snap();
  const busy = [];
  const timer = setInterval(() => {
    const now = snap();
    let b = 0;
    let t = 0;
    for (let i = 0; i < now.length; i++) {
      const dIdle = now[i].idle - last[i].idle;
      const dTotal = Object.keys(now[i]).reduce((a, k) => a + (now[i][k] - last[i][k]), 0);
      b += dTotal - dIdle;
      t += dTotal;
    }
    if (t > 0) busy.push((b / t) * 100);
    last = now;
  }, 1000);
  return {
    stop: () => {
      clearInterval(timer);
      return busy.length ? r(busy.reduce((a, x) => a + x, 0) / busy.length) : null;
    },
  };
}

/**
 * Windows "GPU Engine" performance counter, VideoDecode engines only, summed
 * per adapter LUID (both GPUs on this laptop call themselves phys_0).
 * A hwaccel run that really decoded on the GPU shows tens of percent on one
 * adapter; a silent software fallback shows ~0 on both. This is the proof
 * the log cannot give.
 */
function gpuSampler() {
  if (process.platform !== 'win32') return { stop: () => null };
  // Re-enumerate on every sample: -Continuous freezes the instance list at the
  // first sample, so an ffmpeg that starts later never appears. Both GPUs on
  // this laptop call themselves phys_0; the LUID is what tells them apart.
  const script =
    "while ($true) { Get-Counter '\\GPU Engine(*engtype_VideoDecode)\\Utilization Percentage' -ErrorAction SilentlyContinue | " +
    'ForEach-Object { $t=@{}; foreach ($c in $_.CounterSamples) { if ($c.InstanceName -match "luid_0x[0-9a-f]+_0x([0-9a-f]+)_phys") { $t[$matches[1]] += $c.CookedValue } }; ' +
    "Write-Output (($t.GetEnumerator() | ForEach-Object { $_.Key + '=' + [math]::Round($_.Value,1) }) -join ' ') } }";
  const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const samples = {};
  let buf = '';
  ps.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      for (const kv of line.trim().split(/\s+/)) {
        const m = /^([0-9a-f]+)=([\d.]+)$/.exec(kv);
        if (!m) continue;
        (samples[`luid_${m[1]}`] ??= []).push(Number(m[2]));
      }
    }
  });
  return {
    stop: () => {
      ps.kill();
      const out = {};
      for (const [k, v] of Object.entries(samples)) {
        if (!v.length) continue;
        out[k] = { avg: r(v.reduce((a, x) => a + x, 0) / v.length), max: r(Math.max(...v)), samples: v.length };
      }
      return Object.keys(out).length ? out : null;
    },
  };
}

const r = (v) => Math.round(v * 100) / 100;

async function runVariant(variant, files, args) {
  const dir = path.join(OUT_DIR, 'proxy-cost', args.out ?? variant);
  await fs.mkdir(dir, { recursive: true });
  const queue = [...files];
  const results = [];
  const sampler = cpuSampler();
  const gpu = gpuSampler();
  const t0 = process.hrtime.bigint();
  const worker = async () => {
    while (queue.length) {
      const src = queue.shift();
      // Named by asset id when it came from a project, so T0's --proxy-dir can find it.
      const out = path.join(dir, `${src.assetId ?? path.basename(src.file, path.extname(src.file))}.mp4`);
      process.stdout.write(`  [${variant}] ${path.basename(src.file)} … `);
      const res = await runOne(variant, src, out, args);
      results.push(res);
      console.log(
        `${res.wallSec}s wall, ${res.cpuSec ?? '?'}s cpu, ${res.realtimeX}x realtime` +
          `${res.hwaccelSetupFailed ? '  ** HWACCEL SETUP FAILED (software fallback) **' : ''}`,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(args.concurrency, files.length) }, worker));
  const wallSec = Number(process.hrtime.bigint() - t0) / 1e9;
  const avgCpuPct = sampler.stop();
  const gpuDecode = gpu.stop();
  const gpuMax = gpuDecode ? Math.max(...Object.values(gpuDecode).map((g) => g.max)) : 0;
  const sourceSec = results.reduce((a, x) => a + x.sourceSec, 0);
  const cpuSec = results.every((x) => x.cpuSec != null) ? results.reduce((a, x) => a + x.cpuSec, 0) : null;
  return {
    variant,
    inputArgs: VARIANTS[variant],
    wallSec: r(wallSec),
    sourceSec: r(sourceSec),
    realtimeX: r(sourceSec / wallSec),
    cpuSec: cpuSec != null ? r(cpuSec) : null,
    avgMachineCpuPct: avgCpuPct,
    gpuDecode,
    // Engaged = no setup failure AND the decode engine actually lit up.
    hwaccelEngaged: variant === 'sw' ? null : results.every((x) => !x.hwaccelSetupFailed) && gpuMax > 5,
    files: results,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const files = await loadFiles(args);
  console.log('\nVidTSX proxy-cost bench (T4)');
  for (const f of files) {
    console.log(
      `  ${path.basename(f.file)}  ${f.dims} ${f.codec} ${f.pixFmt} ${f.fps}  ${f.durationSec.toFixed(1)}s  ${(f.bytes / 1073741824).toFixed(2)} GB`,
    );
  }
  console.log(
    `  variants=${args.variants.join(',')} concurrency=${args.concurrency} priority=${args.priority}` +
      `${args.limitSeconds ? ` limit=${args.limitSeconds}s` : ''}\n`,
  );

  const report = {
    tool: 'proxy-cost-bench',
    version: 1,
    startedAt: new Date().toISOString(),
    machine: {
      platform: `${os.platform()} ${os.release()}`,
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      memGb: Math.round(os.totalmem() / 1073741824),
    },
    args,
    files: files.map((f) => ({ ...f, file: path.basename(f.file) })),
    variants: [],
  };
  for (const v of args.variants) {
    report.variants.push(await runVariant(v, files, args));
    console.log('');
  }

  console.log('  variant     wall      source   realtime   cpu-sec   machine-cpu   hwaccel       gpu-decode (avg/max per adapter)');
  console.log('  ' + '-'.repeat(110));
  for (const v of report.variants) {
    const hw = v.hwaccelEngaged === null ? '-' : v.hwaccelEngaged ? 'engaged' : 'NOT ENGAGED';
    const gpuText = v.gpuDecode
      ? Object.entries(v.gpuDecode).map(([k, g]) => `${k} ${g.avg}/${g.max}%`).join('  ')
      : '(no counter)';
    console.log(
      `  ${v.variant.padEnd(9)} ${String(v.wallSec + 's').padStart(8)} ${String(v.sourceSec + 's').padStart(9)}` +
        ` ${String(v.realtimeX + 'x').padStart(9)} ${String(v.cpuSec ?? '?').padStart(9)}` +
        ` ${String((v.avgMachineCpuPct ?? '?') + '%').padStart(12)}   ${hw.padEnd(12)}  ${gpuText}`,
    );
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const outPath = path.join(OUT_DIR, `${stamp}__proxy-cost${args.label ? `__${args.label}` : ''}.json`);
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  console.log(`\nreport: ${path.relative(REPO, outPath)}\n`);
}

main().catch((e) => {
  console.error(`\n[proxy-cost] ${e.message}\n`);
  process.exit(1);
});
