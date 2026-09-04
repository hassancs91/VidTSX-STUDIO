// T8b — seed the 30 s project again, pointed at the all-intra intermediate
// (docs/PREVIEW_TESTS_PLAN.md §T8).
//
//   node scripts/bench/t8-seed-intra.mjs --from=t5-1080p --id=t5-1080p-intra --source=<intermediate.mp4>
//
// Copies ~/Videos/VidTSX Studio/projects/<from>/project.json to a new
// t5-*-prefixed project whose single asset is the intermediate written by
// t8-ffmpeg.mjs --mode=intra, with probe values from ffprobe so the document
// matches what the import path would have written. The timeline (one 30 s
// clip from sourceIn 0) is kept verbatim, so the export renders the same
// frames as the control — only the file the compositor decodes changes.

import { spawn } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  }),
);
if (!args.id || !/^t[567]-[a-z0-9-]+$/.test(args.id)) throw new Error('--id must be t5-*/t6-*/t7-*');
if (!args.source || !fsSync.existsSync(args.source)) throw new Error('--source=<existing file> is required');

function findFfprobe() {
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  return path.join(root, dir, 'bin', 'ffprobe.exe');
}

function probe(file) {
  return new Promise((resolve) => {
    const child = spawn(findFfprobe(), [
      '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
      '-show_entries', 'format=duration', '-of', 'json', file,
    ]);
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('exit', () => resolve(JSON.parse(out)));
  });
}

const root = process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
const fromPath = path.join(root, 'projects', args.from ?? 't5-1080p', 'project.json');
const project = JSON.parse(await fs.readFile(fromPath, 'utf8'));
const p = await probe(path.resolve(args.source));
const v = p.streams.find((s) => s.codec_type === 'video');
const [num, den] = v.r_frame_rate.split('/').map(Number);
const asset = {
  id: randomUUID(),
  kind: 'video',
  path: path.resolve(args.source),
  probe: {
    duration: Number(p.format.duration),
    width: v.width,
    height: v.height,
    fps: Math.round((num / den) * 100) / 100,
    hasAudio: p.streams.some((s) => s.codec_type === 'audio'),
    codec: v.codec_name,
  },
};
const oldId = project.assets[0].id;
project.id = args.id;
project.name = args.name ?? `T8b intra (${path.basename(args.source)})`;
project.assets = [asset];
for (const track of project.timeline.tracks) {
  for (const clip of track.clips) if (clip.assetId === oldId) clip.assetId = asset.id;
}
const now = new Date().toISOString();
project.createdAt = now;
project.updatedAt = now;
const dir = path.join(root, 'projects', args.id);
await fs.mkdir(path.join(dir, 'cache', 'thumbs'), { recursive: true });
await fs.mkdir(path.join(dir, 'shots'), { recursive: true });
await fs.mkdir(path.join(dir, 'renders'), { recursive: true });
await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2), 'utf8');
console.log(`Wrote ${path.join(dir, 'project.json')}\n  asset ${asset.path}\n  probe ${JSON.stringify(asset.probe)}`);
