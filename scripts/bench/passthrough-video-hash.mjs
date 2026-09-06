// Export-engines Stage 2 — is a re-export byte-identical on its copied spans?
//   node scripts/bench/passthrough-video-hash.mjs <a.mp4> <b.mp4> [--frames=450]
// Dumps each file's H.264 elementary stream (stream copy, Annex B) and hashes
// it whole, then hashes the first --frames access units separately so a
// single-clip export can be compared span by span. Also reports the audio
// stream hash (expected to differ only if the audio pass changed).
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fsSync from 'fs';
import os from 'os';
import path from 'path';

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
if (files.length !== 2) { console.error('need two files'); process.exit(1); }

function findFfmpeg() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffmpeg.exe');
}
function dump(ffmpeg, file, extra) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg, ['-v', 'error', '-nostdin', '-i', file, ...extra, '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    p.stdout.on('data', (c) => chunks.push(c));
    p.on('close', (code) => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exit ${code}`))));
  });
}
const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

const ffmpeg = findFfmpeg();
const out = {};
for (const f of files) {
  const video = await dump(ffmpeg, f, ['-map', '0:v:0', '-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb', '-f', 'h264']);
  const row = { bytes: video.length, video: sha(video) };
  if (args.frames) {
    const head = await dump(ffmpeg, f, ['-map', '0:v:0', '-c:v', 'copy', '-bsf:v', 'h264_mp4toannexb', '-frames:v', String(args.frames), '-f', 'h264']);
    row[`first${args.frames}`] = sha(head);
  }
  try {
    const audio = await dump(ffmpeg, f, ['-map', '0:a:0', '-c:a', 'copy', '-f', 'adts']);
    row.audio = sha(audio);
  } catch { row.audio = null; }
  out[path.basename(f)] = row;
}
console.log(JSON.stringify(out, null, 2));
const [a, b] = Object.values(out);
console.log(a.video === b.video ? 'VIDEO STREAMS BYTE-IDENTICAL' : `video streams differ${args.frames ? (a[`first${args.frames}`] === b[`first${args.frames}`] ? ` (first ${args.frames} frames identical)` : ` (first ${args.frames} frames differ too)`) : ''}`);
