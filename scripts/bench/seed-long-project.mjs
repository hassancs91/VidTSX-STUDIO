// T6 — synthesise a long Studio project on disk (docs/PREVIEW_TESTS_PLAN.md §T6).
//
//   node scripts/bench/seed-long-project.mjs --id=t6-stress-3h --hours=3
//   node scripts/bench/seed-long-project.mjs --id=t6-stress-5h --hours=5 --clip-seconds=45
//
// Writes ~/Videos/VidTSX Studio/projects/<id>/project.json straight to disk —
// the OS file picker cannot be driven over CDP (docs/ui-automation-cdp.md,
// "Getting past native dialogs"). The four real 4K60 sources already known to
// the app (three DJI 10-bit HEVC clips from raw/ plus the video-2 H.264
// master, 1,002 s per set) are imported REPEATEDLY AS SEPARATE ASSETS: every
// asset id gets its own proxy, waveform and thumbnail, so the per-asset proxy
// queue is stressed honestly rather than deduplicated by path. Enough sets
// are added to reach --hours of source; the timeline then holds every
// asset cut into --clip-seconds pieces, round-robin across assets so no two
// neighbouring clips share a source file.
//
// Probe values are copied from the projects that imported these files for
// real (raw-footage-test, video-2), so the document is byte-for-byte what
// the import path would have written. Nothing else is seeded: no proxies,
// no waveforms, no thumbnails — that is the point.

import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');

const SOURCES = [
  {
    path: path.join(REPO, 'raw', 'DJI_20260813142309_0270_D.MP4'),
    probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' },
  },
  {
    path: path.join(REPO, 'raw', 'DJI_20260813142610_0271_D.MP4'),
    probe: { duration: 73.0897, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' },
  },
  {
    path: path.join(REPO, 'raw', 'DJI_20260813142800_0272_D.MP4'),
    probe: { duration: 157.9745, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' },
  },
  {
    path: 'C:\\Users\\Malak\\Documents\\GitHub\\claude-youtube-editor\\videos\\video-2\\output\\master-natural-h264.mp4',
    probe: { duration: 632.18155, width: 3840, height: 2160, fps: 59.94, codec: 'h264', hasAudio: true },
  },
];

function parseArgs(argv) {
  const out = { id: null, hours: 3, clipSeconds: 45, width: 1920, height: 1080, fps: 30, force: false, assets: Infinity, timelineSeconds: Infinity };
  for (const arg of argv.slice(2)) {
    const [k, v] = arg.replace(/^--/, '').split('=');
    if (k === 'id') out.id = v;
    else if (k === 'hours') out.hours = Number(v);
    // T5: a short project — first N sources only, timeline capped at S seconds.
    else if (k === 'assets') out.assets = Number(v);
    else if (k === 'timeline-seconds') out.timelineSeconds = Number(v);
    else if (k === 'clip-seconds') out.clipSeconds = Number(v);
    else if (k === 'width') out.width = Number(v);
    else if (k === 'height') out.height = Number(v);
    else if (k === 'fps') out.fps = Number(v);
    else if (k === 'force') out.force = true;
    else throw new Error(`Unknown flag: --${k}`);
  }
  if (!out.id || !/^[a-z0-9][a-z0-9-]*$/.test(out.id)) throw new Error('--id=<folder id> (lowercase, digits, dashes) is required');
  if (!out.id.startsWith('t6-') && !out.id.startsWith('t5-') && !out.id.startsWith('t7-')) {
    throw new Error('Refusing: synthetic projects must be named t5-*/t6-*/t7-* so they are never mistaken for real work');
  }
  return out;
}

function studioProjectsRoot() {
  return process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
}

const r3 = (n) => Math.round(n * 1000) / 1000;

async function main() {
  const args = parseArgs(process.argv);
  for (const s of SOURCES) {
    if (!fsSync.existsSync(s.path)) throw new Error(`Source missing: ${s.path}`);
  }
  const setSeconds = SOURCES.reduce((a, s) => a + s.probe.duration, 0);
  const sets = Math.max(1, Math.round((args.hours * 3600) / setSeconds));

  const assets = [];
  for (let i = 0; i < sets; i++) {
    for (const s of SOURCES) {
      if (assets.length >= args.assets) break;
      assets.push({ id: randomUUID(), kind: 'video', path: s.path, probe: { ...s.probe } });
    }
  }

  // Cut every asset into clip-seconds pieces, then lay them out round-robin
  // across assets so consecutive timeline clips come from different files.
  const perAsset = assets.map((a) => {
    const pieces = [];
    let t = 0;
    while (t < a.probe.duration - 0.5) {
      const d = Math.min(args.clipSeconds, a.probe.duration - t);
      pieces.push({ sourceIn: r3(t), duration: r3(d) });
      t += d;
    }
    return { assetId: a.id, pieces };
  });
  const clips = [];
  let cursor = 0;
  let n = 0;
  for (let round = 0; ; round++) {
    let placed = false;
    for (const pa of perAsset) {
      const piece = pa.pieces[round];
      if (!piece) continue;
      if (cursor + piece.duration > args.timelineSeconds + 1e-6) {
        piece.duration = r3(args.timelineSeconds - cursor);
        if (piece.duration <= 0) { placed = false; break; }
      }
      clips.push({
        id: `clip_t6_${String(n++).padStart(4, '0')}`,
        kind: 'video',
        assetId: pa.assetId,
        timelineStart: r3(cursor),
        duration: piece.duration,
        sourceIn: piece.sourceIn,
        origin: { by: 'user' },
      });
      cursor += piece.duration;
      placed = true;
    }
    if (!placed) break;
  }

  const now = new Date().toISOString();
  const project = {
    schemaVersion: 1,
    id: args.id,
    name: `T6 stress ${args.hours}h (${sets}×4 assets, ${clips.length} clips)`,
    createdAt: now,
    updatedAt: now,
    settings: { width: args.width, height: args.height, fps: args.fps, agent: {} },
    assets,
    timeline: {
      tracks: [
        { id: 'v1', kind: 'video', name: 'V1', clips },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
    proposals: [],
    shots: [],
  };

  const dir = path.join(studioProjectsRoot(), 'projects', args.id);
  if (fsSync.existsSync(dir) && !args.force) {
    throw new Error(`${dir} already exists — pass --force to overwrite project.json (cache/ is left alone)`);
  }
  await fs.mkdir(path.join(dir, 'cache', 'thumbs'), { recursive: true });
  await fs.mkdir(path.join(dir, 'shots'), { recursive: true });
  await fs.mkdir(path.join(dir, 'renders'), { recursive: true });
  await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2), 'utf8');

  const totalSource = assets.reduce((a, x) => a + x.probe.duration, 0);
  console.log(
    [
      `Wrote ${path.join(dir, 'project.json')}`,
      `  sets ${sets} → assets ${assets.length} (${r3(totalSource / 3600)} h of 4K60 source)`,
      `  clips ${clips.length} × ≤${args.clipSeconds} s → timeline ${r3(cursor / 3600)} h (${Math.round(cursor)} s)`,
      `  composition ${args.width}×${args.height} @ ${args.fps}`,
    ].join('\n'),
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
