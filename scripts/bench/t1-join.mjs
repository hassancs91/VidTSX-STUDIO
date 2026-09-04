// T1 leg 3 — join a passthrough span to a browser-rendered span, frame-exact,
// and hand back a file the diff/audio instruments can check (§T1).
//
//   node scripts/bench/t1-join.mjs --first=<passthrough-0-15.mp4> --second=<remotion-15-30.mp4> --mode=ts|mp4 --label=t1-join-ts [--audio=<single-pass-audio.m4a|mp4>]
//
// mp4 : the proxy generator's recipe (proxy-generator.ts concatArgs) — concat
//       demuxer over the two mp4s with explicit durations, stream copy. That
//       recipe assumes one encoder; here the halves come from h264_nvenc and
//       Remotion's libx264, whose SPS/PPS differ.
// ts  : PLAN.md §5's "TS-intermediate concat" — each half to MPEG-TS with
//       h264_mp4toannexb (parameter sets in-band), concat demuxer, stream
//       copy back into mp4 (aac_adtstoasc on the audio).
// --audio : mux this file's audio track instead of the halves' own (a
//       single-pass audio for the whole span, the proxy generator's lesson:
//       "no priming gaps at window joins the way per-segment audio would").
//
// Reports ffprobe frame count and stream timings to .vidtsx-temp/bench/t1/join/.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const OUT_DIR = path.join(REPO, '.vidtsx-temp', 'bench', 't1', 'join');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
const mode = args.mode ?? 'ts';
const label = args.label ?? `t1-join-${mode}`;

function findBins() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return { ffmpeg: path.join(root, dir, 'bin', 'ffmpeg.exe'), ffprobe: path.join(root, dir, 'bin', 'ffprobe.exe') };
}
function run(exe, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(exe)} exit ${code}: ${err.slice(-1200)}`))));
  });
}
async function probe(ffprobe, file) {
  const { out } = await run(ffprobe, ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,codec_name,start_time,duration,nb_read_frames,r_frame_rate,time_base', '-show_entries', 'format=duration', '-of', 'json', file]);
  return JSON.parse(out);
}

async function main() {
  const { ffmpeg, ffprobe } = findBins();
  await fs.mkdir(OUT_DIR, { recursive: true });
  const first = path.resolve(args.first), second = path.resolve(args.second);
  const out = path.join(OUT_DIR, `${label}.mp4`);
  const steps = [];
  const audioMap = args.audio ? ['-i', path.resolve(args.audio), '-map', '0:v:0', '-map', '1:a:0'] : ['-map', '0:v:0', '-map', '0:a:0?'];
  if (mode === 'mp4') {
    // explicit durations, as proxy-concat.ts does (container durations of B-frame segments can run a frame long)
    const d1 = (await probe(ffprobe, first)).streams.find((s) => s.codec_type === 'video');
    const list = path.join(OUT_DIR, `${label}.txt`);
    await fs.writeFile(list, `file '${first.replace(/\\/g, '/')}'\nduration ${Number(d1.nb_read_frames) / 30}\nfile '${second.replace(/\\/g, '/')}'\n`);
    const a = ['-y', '-hide_banner', '-nostdin', '-f', 'concat', '-safe', '0', '-i', list, ...audioMap, '-c', 'copy', '-movflags', '+faststart', out];
    steps.push(a.join(' '));
    const r = await run(ffmpeg, a); if (r.err.trim()) steps.push('stderr: ' + r.err.trim().slice(-600));
  } else {
    const ts = [];
    for (const [i, f] of [first, second].entries()) {
      const t = path.join(OUT_DIR, `${label}-${i}.ts`);
      // With --audio the intermediates are VIDEO ONLY: an AAC track's 1024-sample
      // priming survives into MPEG-TS as a 21.3 ms start offset that drags the
      // video pts with it (measured: frame 0 at 0.021 s), which would desync a
      // single-pass audio muxed in afterwards.
      const a = ['-y', '-hide_banner', '-nostdin', '-i', f, '-map', '0:v:0', ...(args.audio ? ['-an'] : ['-map', '0:a:0?']), '-c', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', t];
      steps.push(a.join(' '));
      const r = await run(ffmpeg, a); if (r.err.trim()) steps.push('stderr: ' + r.err.trim().slice(-600));
      ts.push(t);
    }
    const list = path.join(OUT_DIR, `${label}.txt`);
    await fs.writeFile(list, ts.map((t) => `file '${t.replace(/\\/g, '/')}'`).join('\n') + '\n');
    const a = ['-y', '-hide_banner', '-nostdin', '-f', 'concat', '-safe', '0', '-i', list, ...audioMap, '-c', 'copy', ...(args.audio ? [] : ['-bsf:a', 'aac_adtstoasc']), '-movflags', '+faststart', out];
    steps.push(a.join(' '));
    const r = await run(ffmpeg, a); if (r.err.trim()) steps.push('stderr: ' + r.err.trim().slice(-600));
  }
  const p = await probe(ffprobe, out);
  const report = { label, mode, first, second, audio: args.audio ?? null, output: out, steps, streams: p.streams, format: p.format, at: new Date().toISOString() };
  await fs.writeFile(path.join(OUT_DIR, `${label}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output: out, video: p.streams.find((s) => s.codec_type === 'video'), audio: p.streams.find((s) => s.codec_type === 'audio'), duration: p.format?.duration, warnings: steps.filter((s) => s.startsWith('stderr')) }, null, 1));
}
main().catch((err) => { console.error(err.message); process.exit(1); });
