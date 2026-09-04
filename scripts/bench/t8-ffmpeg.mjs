// T8b / T8c — the ffmpeg side of the export-path tests (docs/PREVIEW_TESTS_PLAN.md §T8).
//
//   node scripts/bench/t8-ffmpeg.mjs --mode=passthrough --cq=23 [--seconds=30] [--label=t8c-cq23]
//   node scripts/bench/t8-ffmpeg.mjs --mode=intra --encoder=nvenc --cq=18 [--label=t8b-intra-nvenc]
//   node scripts/bench/t8-ffmpeg.mjs --mode=intra --encoder=x264 --crf=16 [--label=t8b-intra-x264]
//
// passthrough (T8c): the T4b pipeline with no browser — NVDEC (`-hwaccel cuda`)
//   → scale_cuda to 1920×1080 → h264_nvenc, conformed to the composition's 30 fps,
//   AAC audio. The first --seconds of the T5 clip, i.e. exactly the span the
//   30 s project exports. This is the floor a passthrough span could reach.
// intra (T8b): the same source to an ALL-INTRA 4K intermediate at full
//   resolution (h264_nvenc `-g 0`, or libx264 `-g 1`), the "optimised media"
//   a touched span would be rendered from. Reported per minute of source.
//
// Every run records wall, ffmpeg CPU time (TotalProcessorTime via PowerShell),
// output bytes, ffprobe frame count/dimensions, and Mbps, to
// .vidtsx-temp/bench/t8/<label>.json. The binary is the T4b full build in
// userData/ffmpeg-full (the bundled ffmpeg has no NVENC).

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't8');
const SOURCE = path.join(REPO, 'raw', 'DJI_20260813142309_0270_D.MP4');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  }),
);
const mode = args.mode ?? 'passthrough';
const seconds = Number(args.seconds ?? 30);
const encoder = args.encoder ?? 'nvenc';
const label =
  args.label ??
  `${mode === 'passthrough' ? 't8c' : 't8b-intra'}-${encoder}${args.cq ? `-cq${args.cq}` : ''}${args.crf ? `-crf${args.crf}` : ''}`;

function findFullFfmpeg() {
  const root = path.join(
    process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
    'VidTSX Studio',
    'ffmpeg-full',
  );
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  if (!dir) throw new Error(`no ffmpeg-full build under ${root}`);
  return {
    ffmpeg: path.join(root, dir, 'bin', 'ffmpeg.exe'),
    ffprobe: path.join(root, dir, 'bin', 'ffprobe.exe'),
  };
}

function buildArgs(outPath) {
  const common = ['-y', '-hide_banner', '-loglevel', 'error', '-stats'];
  if (mode === 'passthrough') {
    const cq = args.cq ?? '23';
    return [
      ...common,
      '-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda', '-t', String(seconds), '-i', SOURCE,
      '-vf', 'scale_cuda=w=1920:h=1080:format=yuv420p',
      '-r', '30',
      '-c:v', 'h264_nvenc', '-preset', args.preset ?? 'p5', '-rc', 'vbr', '-cq', cq, '-b:v', '0', '-bf', '2', '-g', '60',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart',
      outPath,
    ];
  }
  if (mode === 'intra' && encoder === 'nvenc') {
    const cq = args.cq ?? '18';
    return [
      ...common,
      // NVDEC into system memory, CPU p010 → yuv420p, NVENC from system
      // memory. The all-on-card shape (`-hwaccel_output_format cuda` +
      // `scale_cuda=format=yuv420p`, with or without an explicit 3840×2160)
      // produced SOLID GREEN frames at 1.6 KB each on this driver when the
      // size does not change — the 1080p passthrough (a real resize) is fine.
      // Measured T8b 2026-09-04; the shipped proxy path always resizes.
      '-hwaccel', 'cuda', '-t', String(seconds), '-i', SOURCE,
      '-pix_fmt', 'yuv420p',
      '-c:v', 'h264_nvenc', '-preset', args.preset ?? 'p4', '-rc', 'vbr', '-cq', cq, '-b:v', '0', '-g', '0', '-bf', '0',
      '-c:a', 'copy',
      outPath,
    ];
  }
  if (mode === 'intra' && encoder === 'x264') {
    const crf = args.crf ?? '16';
    return [
      ...common,
      '-hwaccel', 'cuda', '-t', String(seconds), '-i', SOURCE,
      '-pix_fmt', 'yuv420p',
      '-c:v', 'libx264', '-preset', args.preset ?? 'veryfast', '-crf', crf, '-g', '1', '-bf', '0', '-tune', 'fastdecode',
      '-c:a', 'copy',
      outPath,
    ];
  }
  throw new Error(`unknown --mode/--encoder ${mode}/${encoder}`);
}

// PowerShell runs ffmpeg so the child's TotalProcessorTime is readable after exit.
function runTimed(exe, ffArgs) {
  const quoted = ffArgs.map((a) => `'${a.replace(/'/g, "''")}'`).join(',');
  const ps =
    `$p = Start-Process -FilePath '${exe}' -ArgumentList @(${quoted}) -NoNewWindow -PassThru -Wait; ` +
    `[pscustomobject]@{ exit=$p.ExitCode; cpuS=[math]::Round($p.TotalProcessorTime.TotalSeconds,1) } | ConvertTo-Json -Compress`;
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const child = spawn('powershell', ['-NoProfile', '-Command', ps], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.on('exit', () => {
      const wallMs = Date.now() - t0;
      const line = out.trim().split('\n').pop();
      try {
        resolve({ wallMs, ...JSON.parse(line) });
      } catch {
        reject(new Error(`bad ps output: ${out}`));
      }
    });
  });
}

function probe(ffprobe, file) {
  return new Promise((resolve) => {
    const child = spawn(ffprobe, [
      '-v', 'error', '-select_streams', 'v:0', '-count_frames',
      '-show_entries', 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames',
      '-show_entries', 'format=duration,size,bit_rate', '-of', 'json', file,
    ]);
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
    });
    child.on('exit', () => resolve(JSON.parse(out)));
  });
}

async function main() {
  const { ffmpeg, ffprobe } = findFullFfmpeg();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${label}.mp4`);
  const ffArgs = buildArgs(outPath);
  console.log(`[${label}] ffmpeg ${ffArgs.join(' ')}`);
  const timing = await runTimed(ffmpeg, ffArgs);
  if (timing.exit !== 0) throw new Error(`ffmpeg exit ${timing.exit}`);
  const p = await probe(ffprobe, outPath);
  const st = p.streams?.[0] ?? {};
  const bytes = Number(p.format?.size ?? 0);
  const durationS = Number(p.format?.duration ?? seconds);
  const result = {
    label, mode, encoder, source: SOURCE, seconds, args: ffArgs,
    wallS: Math.round(timing.wallMs / 100) / 10,
    cpuS: timing.cpuS,
    realtimeX: Math.round((seconds / (timing.wallMs / 1000)) * 100) / 100,
    output: outPath,
    bytes,
    mb: Math.round(bytes / 1e5) / 10,
    mbps: Math.round(((bytes * 8) / durationS) / 1e5) / 10,
    gbPerMinute: Math.round((bytes / 1e9) * (60 / durationS) * 1000) / 1000,
    frames: Number(st.nb_read_frames),
    width: st.width, height: st.height, codec: st.codec_name, pixFmt: st.pix_fmt, fps: st.r_frame_rate,
    at: new Date().toISOString(),
  };
  await fs.writeFile(path.join(OUT_DIR, `${label}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
