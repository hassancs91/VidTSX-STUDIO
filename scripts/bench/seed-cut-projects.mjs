// Export-engines Stage 3 — seed the short two-file / gain projects the slice-1
// gates ran on (docs/export-engines-plan.md §Stage 3 log). Companion to
// seed-long-project.mjs (the long T6 timelines).
//
//   node scripts/bench/seed-cut-projects.mjs diff-cut   → t5-1080p-cut-files  (0270 0–3 s | 0272 15–18 s)
//   node scripts/bench/seed-cut-projects.mjs diff-cut2  → t5-1080p-cut-files2 (0270 0–3 s | 0272 6.667–9.667 s | 0270 30–33 s)
//   node scripts/bench/seed-cut-projects.mjs gain       → t5-1080p-cut-gain   (the T1 cut with gain 0.5 on clip B)
//   … [--force] to overwrite project.json (cache/ is left alone)
//
// Writes ~/Videos/VidTSX Studio/projects/<id>/project.json straight to disk, in
// the shape the import path writes (probe values copied from the projects that
// imported these files for real). The 0270 asset keeps the id the T1 reference
// projects use, so its proxy is shared.
import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../..');
const RAW = path.join(REPO, 'raw');
const A0270 = { id: 'c9ed8f79-f1c6-4c8f-92ce-7c92a4a1b106', kind: 'video', path: path.join(RAW, 'DJI_20260813142309_0270_D.MP4'), probe: { duration: 139.022233, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } };
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
};
const project = seeds[which];
if (!project) {
  console.error('usage: seed-cut-projects.mjs diff-cut | diff-cut2 | gain [--force]');
  process.exit(1);
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
