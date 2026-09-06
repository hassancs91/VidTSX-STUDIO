// Export-engines Stage 3 — seed the short two-file / gain projects the slice-1
// gates ran on (docs/export-engines-plan.md §Stage 3 log). Companion to
// seed-long-project.mjs (the long T6 timelines).
//
//   node scripts/bench/seed-cut-projects.mjs diff-cut   → t5-1080p-cut-files  (0270 0–3 s | 0272 15–18 s)
//   node scripts/bench/seed-cut-projects.mjs diff-cut2  → t5-1080p-cut-files2 (0270 0–3 s | 0272 6.667–9.667 s | 0270 30–33 s)
//   node scripts/bench/seed-cut-projects.mjs gain       → t5-1080p-cut-gain   (the T1 cut with gain 0.5 on clip B)
//   node scripts/bench/seed-cut-projects.mjs music      → t5-1080p-cut-music  (the T1 cut with a music clip on A1, 5–25 s, gain 0.5;
//                                                          generates raw/music-40s.wav — pink noise + a 330 Hz tone — with the full ffmpeg if missing)
//   node scripts/bench/seed-cut-projects.mjs stack      → t5-1080p-cut-stack  (the T1 cut as two tracks: V1 15–30 s from 15 s, muted, over V2 0–30 s)
//   … [--force] to overwrite project.json (cache/ is left alone)
//
// Writes ~/Videos/VidTSX Studio/projects/<id>/project.json straight to disk, in
// the shape the import path writes (probe values copied from the projects that
// imported these files for real). The 0270 asset keeps the id the T1 reference
// projects use, so its proxy is shared.
import { spawnSync } from 'child_process';
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const RAW = path.join(REPO, 'raw');
const A0270 = { id: 'c9ed8f79-f1c6-4c8f-92ce-7c92a4a1b106', kind: 'video', path: path.join(RAW, 'DJI_20260813142309_0270_D.MP4'), probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } };
const MUSIC = { id: 'a1b2c3d4-music-40s0-8000-000000000001', kind: 'audio', path: path.join(RAW, 'music-40s.wav'), probe: { duration: 40, hasAudio: true, codec: 'pcm_s16le' } };
const A0272 = { id: '4f0c2c8e-1d3b-4b7a-9c6e-0272aaaa0272', kind: 'video', path: path.join(RAW, 'DJI_20260813142800_0272_D.MP4'), probe: { duration: 157.9745, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } };

const which = process.argv[2];
const force = process.argv.includes('--force');
const now = new Date().toISOString();
const base = (id, name, assets, clips) => ({
  schemaVersion: 1, id, name, createdAt: now, updatedAt: now,
  settings: { width: 1920, height: 1080, fps: 30, agent: {} },
  assets,
  timeline: { tracks: [{ id: 'v1', kind: 'video', name: 'V1', clips }, { id: 'a1', kind: 'audio', name: 'A1', clips: [] }] },
  proposals: [], shots: [],
});
const clip = (id, assetId, timelineStart, duration, sourceIn, extra = {}) => ({ id, kind: 'video', assetId, timelineStart, duration, sourceIn, origin: { by: 'user' }, ...extra });

/** A 40 s stereo 48 kHz WAV whose 1 s windows cross-correlate sharply (noise), plus a tone so a level is easy to hear. */
function ensureMusic() {
  if (fsSync.existsSync(MUSIC.path)) return;
  const root = path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'VidTSX Studio', 'ffmpeg-full');
  const dir = fsSync.readdirSync(root).find((d) => d.startsWith('ffmpeg-'));
  if (!dir) { console.error('no ffmpeg-full to generate the music file'); process.exit(1); }
  const r = spawnSync(path.join(root, dir, 'bin', 'ffmpeg.exe'), [
    '-y', '-v', 'error', '-nostdin',
    '-f', 'lavfi', '-i', 'anoisesrc=color=pink:seed=42:amplitude=0.3:r=48000:d=40',
    '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=48000:duration=40',
    '-filter_complex', '[1]volume=0.15[t];[0][t]amix=inputs=2:normalize=0,aformat=sample_fmts=s16:channel_layouts=stereo[out]',
    '-map', '[out]', '-c:a', 'pcm_s16le', MUSIC.path,
  ], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('music generation failed'); process.exit(1); }
  console.log(`Generated ${MUSIC.path}`);
}

const seeds = {
  'diff-cut': base('t5-1080p-cut-files', 'T1 cut files (0270 0-3 s | 0272 15-18 s, two files, cut at frame 90)', [A0270, A0272], [
    clip('clip_t1_files_a', A0270.id, 0, 3, 0),
    clip('clip_t1_files_b', A0272.id, 3, 3, 15),
  ]),
  'diff-cut2': base('t5-1080p-cut-files2', 'T1 cut files 2 (0270 0-3 s | 0272 6.667-9.667 s | 0270 30-33 s, A-B-A, cuts at 90 and 180)', [A0270, A0272], [
    clip('clip_t1_files2_a', A0270.id, 0, 3, 0),
    clip('clip_t1_files2_b', A0272.id, 3, 3, 6.667),
    clip('clip_t1_files2_c', A0270.id, 6, 3, 30),
  ]),
  'gain': base('t5-1080p-cut-gain', 'T1 cut gain (0-15 s | 15-30 s, gain 0.5 on clip B)', [A0270], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15, { gain: 0.5 }),
  ]),
  'stack': {
    ...base('t5-1080p-cut-stack', 'T1 cut stack (V1 15-30 s from 15 s, muted, over V2 0-30 s; the T1 cut as two tracks)', [A0270], []),
    timeline: { tracks: [
      { id: 'v1', kind: 'video', name: 'V1', muted: true, clips: [clip('clip_t1_stack_top', A0270.id, 15, 15, 15)] },
      { id: 'v2', kind: 'video', name: 'V2', clips: [clip('clip_t1_stack_base', A0270.id, 0, 30, 0)] },
      { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
    ] },
  },
  'music': base('t5-1080p-cut-music', 'T1 cut music (0-15 s | 15-30 s, music on A1 5-25 s from 2 s at gain 0.5)', [A0270, MUSIC], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15),
  ]),
};
const project = seeds[which];
if (!project) {
  console.error('usage: seed-cut-projects.mjs diff-cut | diff-cut2 | gain | music | stack [--force]');
  process.exit(1);
}
if (which === 'music') {
  ensureMusic();
  project.timeline.tracks[1].clips.push({ ...clip('clip_t1_music', MUSIC.id, 5, 20, 2, { gain: 0.5 }), kind: 'audio' });
}
for (const a of project.assets) {
  if (!fsSync.existsSync(a.path)) { console.error(`Source missing: ${a.path}`); process.exit(1); }
}
const root = process.env.VIDTSX_STUDIO_ROOT ?? path.join(os.homedir(), 'Videos', 'VidTSX Studio');
const dir = path.join(root, 'projects', project.id);
if (fsSync.existsSync(dir) && !force) { console.error(`${dir} already exists — pass --force to overwrite project.json`); process.exit(1); }
await fs.mkdir(path.join(dir, 'cache', 'thumbs'), { recursive: true });
await fs.mkdir(path.join(dir, 'shots'), { recursive: true });
await fs.mkdir(path.join(dir, 'renders'), { recursive: true });
await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2), 'utf8');
console.log(`Wrote ${path.join(dir, 'project.json')} — "${project.name}"`);
