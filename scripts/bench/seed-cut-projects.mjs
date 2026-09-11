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
//   node scripts/bench/seed-cut-projects.mjs fade       → t5-1080p-cut-fade   (the T1 cut: fade out 0.5 s on clip A; gain 0.5, fade in 1 s + fade out 2 s on clip B — slice 3)
//   node scripts/bench/seed-cut-projects.mjs xfade      → t5-1080p-cut-xfade  (the T1 cut with a 1 s crossfade at 15 s — slice 3)
//   node scripts/bench/seed-cut-projects.mjs xfade3     → t5-1080p-cut-xfade3  (the T1 cut with a 3 s crossfade — Stage 4: a 90-frame browser span)
//   node scripts/bench/seed-cut-projects.mjs xfade2x    → t5-1080p-cut-xfade2x (0–12 s | 12–15 s | 15–30 s with 1 s crossfades at 12 s and 15 s — Stage 4: two 30-frame browser spans 60 copied frames apart)
//   node scripts/bench/seed-cut-projects.mjs speed      → t5-1080p-cut-speed  (the T1 cut with clip B at speed 1.5; the music clip on A1 2–12 s from 2 s at speed 1.5, gain 0.5 — slice 3's measurement)
//   node scripts/bench/seed-cut-projects.mjs speed2     → t5-1080p-cut-speed2 (0270 0–15 s, then 0272 at speed 2 from 127.9745 s to its end with gain 0.5 + fade in 1 s + fade out 1 s;
//                                                          the music clip on A1 2–12 s from 2 s at speed 3, gain 0.5 — slice 4: a sped clip that OPENS a file, runs to the source end, fades, and a rate outside atempo's range)
//   node scripts/bench/seed-cut-projects.mjs return     → t5-1080p-cut-return  (0270 0-10 s | 0271 60 s, 0273 100 s, 0274 60 s, 0275 100 s | 0270 from 45.867 s —
//                                                          the long-return question, 2026-09-11: a return after 320 s of four other files, at a non-grid source time)
//   node scripts/bench/seed-cut-projects.mjs return-short → t5-1080p-cut-return-short (0270 0-10 s | 0271 5 s | 0270 from 45.867 s | jump to 60.2 s | jump back to 29.2 s — the control:
//                                                          a 5 s return, a same-file forward seek inside the open stream, a same-file jump back)
//   node scripts/bench/seed-cut-projects.mjs return-1m  → t5-1080p-cut-return-1m (0270 0-10 s | 0271 30 s | 0273 30 s | 0270 from 45.867 s — a 1 min return through two other files)
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
// Item 1 (2026-09-11, the long-return question): the other DJI files, each a plain cut, so a return to 0270
// after minutes of other material can be measured (probe values from ffprobe: 59.94 fps 4K HEVC, sound on).
const dji = (n, file, duration) => ({ id: `5a1b2c3d-${n}-4b7a-9c6e-${n}aaaa${n}`, kind: 'video', path: path.join(RAW, file), probe: { duration, width: 3840, height: 2160, fps: 59.94, hasAudio: true, codec: 'hevc' } });
const A0271 = dji('0271', 'DJI_20260813142610_0271_D.MP4', 73.0897);
const A0273 = dji('0273', 'DJI_20260813143053_0273_D.MP4', 281.030767);
const A0274 = dji('0274', 'DJI_20260813143540_0274_D.MP4', 175.8924);
const A0275 = dji('0275', 'DJI_20260813143841_0275_D.MP4', 278.027767);
// The return's source time sits on the 30 fps grid (trimBefore = round(sourceIn × 30)) at a NON-grid 59.94 fps
// position, so the ceil and the nearest source frame differ: 1376/30 = 45.8667 s → K 2749.25 (nearest 2749,
// ceil 2750); 1806/30 = 60.2 s → K 3608.39 (3608 / 3609); 876/30 = 29.2 s → K 1750.25 (1750 / 1751).
const RETURN_IN = 1376 / 30;
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
  'fade': base('t5-1080p-cut-fade', 'T1 cut fade (0-15 s | 15-30 s, fade out 0.5 s on A, gain 0.5 + fade in 1 s + fade out 2 s on B)', [A0270], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0, { fadeOutSec: 0.5 }),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15, { gain: 0.5, fadeInSec: 1, fadeOutSec: 2 }),
  ]),
  'xfade': base('t5-1080p-cut-xfade', 'T1 cut xfade (0-15 s | 15-30 s, 1 s crossfade at 15 s)', [A0270], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15),
  ]),
  // Stage 4's browser-span cost curve: one 90-frame window, and two 30-frame windows 60 copied frames apart.
  'xfade3': base('t5-1080p-cut-xfade3', 'T1 cut xfade 3 s (0-15 s | 15-30 s, 3 s crossfade at 15 s)', [A0270], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0, { transitionOut: { kind: 'crossfade', duration: 3 } }),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15),
  ]),
  'xfade2x': base('t5-1080p-cut-xfade2x', 'T1 cut xfade x2 (0-12 s | 12-15 s | 15-30 s, 1 s crossfades at 12 s and 15 s)', [A0270], [
    clip('clip_t1_cut_a', A0270.id, 0, 12, 0, { transitionOut: { kind: 'crossfade', duration: 1 } }),
    clip('clip_t1_cut_m', A0270.id, 12, 3, 12, { transitionOut: { kind: 'crossfade', duration: 1 } }),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15),
  ]),
  'speed': base('t5-1080p-cut-speed', 'T1 cut speed (0-15 s | 15-30 s at speed 1.5 on B, music on A1 2-12 s from 2 s at speed 1.5)', [A0270, MUSIC], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15, { speed: 1.5 }),
  ]),
  'speed2': base('t5-1080p-cut-speed2', 'T1 cut speed 2 (0270 0-15 s | 0272 from 127.9745 s at speed 2 to its end, gain 0.5 + fades 1 s on B; music on A1 2-12 s from 2 s at speed 3)', [A0270, A0272, MUSIC], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0),
    clip('clip_t1_speed2_b', A0272.id, 15, 15, 127.9745, { speed: 2, gain: 0.5, fadeInSec: 1, fadeOutSec: 1 }),
  ]),
  // Item 1 (2026-09-11): the long-return question — does a return to 0270 after minutes of other files show
  // the ceil frame (an open) or the nearest (a return)? The plain Remotion export decides; the control seed
  // re-measures the short return with a moving shot and adds two same-file jumps.
  'return': base('t5-1080p-cut-return', 'T1 cut return (0270 0-10 s | 320 s of other files | 0270 from 45.867 s)', [A0270, A0271, A0273, A0274, A0275], [
    clip('clip_t1_return_a', A0270.id, 0, 10, 0),
    clip('clip_t1_return_b1', A0271.id, 10, 60, 0),
    clip('clip_t1_return_b2', A0273.id, 70, 100, 0),
    clip('clip_t1_return_b3', A0274.id, 170, 60, 0),
    clip('clip_t1_return_b4', A0275.id, 230, 100, 0),
    clip('clip_t1_return_c', A0270.id, 330, 10, RETURN_IN),
  ]),
  'return-short': base('t5-1080p-cut-return-short', 'T1 cut return short (0270 0-10 s | 0271 5 s | 0270 from 45.867 s, jumps to 60.2 s and 29.2 s)', [A0270, A0271], [
    clip('clip_t1_return_a', A0270.id, 0, 10, 0),
    clip('clip_t1_return_b', A0271.id, 10, 5, 0),
    clip('clip_t1_return_c', A0270.id, 15, 10, RETURN_IN),
    clip('clip_t1_return_d', A0270.id, 25, 5, 1806 / 30),
    clip('clip_t1_return_e', A0270.id, 30, 5, 876 / 30),
  ]),
  'return-1m': base('t5-1080p-cut-return-1m', 'T1 cut return 1 min (0270 0-10 s | 0271 30 s | 0273 30 s | 0270 from 45.867 s)', [A0270, A0271, A0273], [
    clip('clip_t1_return_a', A0270.id, 0, 10, 0),
    clip('clip_t1_return_b1', A0271.id, 10, 30, 0),
    clip('clip_t1_return_b2', A0273.id, 40, 30, 0),
    clip('clip_t1_return_c', A0270.id, 70, 10, RETURN_IN),
  ]),
  'music': base('t5-1080p-cut-music', 'T1 cut music (0-15 s | 15-30 s, music on A1 5-25 s from 2 s at gain 0.5)', [A0270, MUSIC], [
    clip('clip_t1_cut_a', A0270.id, 0, 15, 0),
    clip('clip_t1_cut_b', A0270.id, 15, 15, 15),
  ]),
};
const project = seeds[which];
if (!project) {
  console.error('usage: seed-cut-projects.mjs diff-cut | diff-cut2 | gain | music | stack | fade | xfade | xfade3 | xfade2x | speed | speed2 | return | return-short | return-1m [--force]');
  process.exit(1);
}
if (which === 'music') {
  ensureMusic();
  project.timeline.tracks[1].clips.push({ ...clip('clip_t1_music', MUSIC.id, 5, 20, 2, { gain: 0.5 }), kind: 'audio' });
}
if (which === 'speed') {
  ensureMusic();
  project.timeline.tracks[1].clips.push({ ...clip('clip_t1_music_speed', MUSIC.id, 2, 10, 2, { gain: 0.5, speed: 1.5 }), kind: 'audio' });
}
if (which === 'speed2') {
  ensureMusic();
  project.timeline.tracks[1].clips.push({ ...clip('clip_t1_music_speed3', MUSIC.id, 2, 10, 2, { gain: 0.5, speed: 3 }), kind: 'audio' });
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
