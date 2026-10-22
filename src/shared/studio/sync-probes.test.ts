import { describe, expect, it } from 'vitest';
import type { StudioProject } from '../types/studio';
import { planSyncProbes, pictureRects } from './sync-probes';

const CAM = { id: 'cam', path: 'D:/cam/master.mp4', probe: { hasAudio: true, width: 3840, height: 2160, duration: 485.7 } };
const PIP = { x: 1615.733, y: 596, scale: 0.388889 };

type ClipSpec = { id: string; kind: string; start: number; duration: number; sourceIn?: number; assetId?: string; speed?: number; transform?: object; tsx?: object };

function project(shots: ClipSpec[], v1: ClipSpec[], extra: object[] = []): StudioProject {
  const clip = (c: ClipSpec) => ({ ...c, timelineStart: c.start });
  return {
    settings: { width: 3840, height: 2160, fps: 60 },
    assets: [CAM, ...extra],
    timeline: {
      tracks: [
        { id: 'shots', kind: 'overlay', name: 'TSX shots', clips: shots.map(clip) },
        { id: 'v1', kind: 'video', name: 'V1', clips: v1.map(clip) },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    },
  } as unknown as StudioProject;
}

/** The A5 range 80–110 s of video-14 as its export context holds it (trimmed, t = 0 at 80 s). */
const a5Range = () =>
  project(
    [
      { id: 's1', kind: 'tsx', start: 0, duration: 5.4, tsx: { shotId: 'v14-a1-one-word', mode: 'cutaway' } },
      { id: 's2', kind: 'tsx', start: 5.4, duration: 4.5, tsx: { shotId: 'v14-a1-template', mode: 'cutaway' } },
      { id: 's3', kind: 'tsx', start: 9.9, duration: 13.25, tsx: { shotId: 'v14-a1-scratch', mode: 'overlay' } },
      { id: 's4', kind: 'tsx', start: 23.15, duration: 6.85, tsx: { shotId: 'v14-a2-starter', mode: 'cutaway' } },
    ],
    [
      { id: 'plain', kind: 'video', assetId: 'cam', start: 0, duration: 9.9, sourceIn: 80 },
      { id: 'split', kind: 'video', assetId: 'cam', start: 9.9, duration: 13.25, sourceIn: 89.9, transform: PIP },
      { id: 'plain2', kind: 'video', assetId: 'cam', start: 23.15, duration: 6.85, sourceIn: 103.15 },
    ],
  );

const OUT_4K = { width: 3840, height: 2160 };

describe('sync probe placement (T8)', () => {
  it('maps the PiP box back to the camera frame (off-screen part dropped, even pixels)', () => {
    const r = pictureRects({ width: 3840, height: 2160 }, OUT_4K, { width: 3840, height: 2160 }, PIP);
    expect(r).toEqual({ exportRect: { x: 2790, y: 1256, width: 1050, height: 840 }, sourceRect: { x: 2, y: 0, width: 2700, height: 2160 } });
    const full = pictureRects({ width: 3840, height: 2160 }, { width: 1920, height: 1080 }, { width: 3840, height: 2160 }, undefined);
    expect(full).toEqual({ exportRect: { x: 0, y: 0, width: 1920, height: 1080 }, sourceRect: { x: 0, y: 0, width: 3840, height: 2160 } });
  });

  it('letterboxes a 4:3 camera inside a 16:9 frame (objectFit contain)', () => {
    const r = pictureRects({ width: 1920, height: 1080 }, { width: 1920, height: 1080 }, { width: 1440, height: 1080 }, undefined);
    expect(r?.exportRect).toEqual({ x: 240, y: 0, width: 1440, height: 1080 });
    expect(r?.sourceRect).toEqual({ x: 0, y: 0, width: 1440, height: 1080 });
  });

  it('video-14 80–110 s: every probe lands in the split, under the overlay, never under a cutaway', () => {
    const plan = planSyncProbes(a5Range(), { durationSec: 30, fps: 60, output: OUT_4K });
    expect(plan.reference).toEqual({ assetId: 'cam', path: 'D:/cam/master.mp4', width: 3840, height: 2160 });
    expect(plan.probes).toHaveLength(16);
    // Probe starts: split 9.9–23.15, 0.25 s edges, a 2 s audio window → 10.15 … 20.9.
    expect(plan.visibleSec).toBeCloseTo(10.75, 6);
    for (const p of plan.probes) {
      expect(p.clipId).toBe('split');
      expect(p.t).toBeGreaterThanOrEqual(10.15);
      expect(p.t).toBeLessThanOrEqual(20.9);
      expect(p.t).toBeCloseTo(p.frame / 60, 9);
      expect(p.sourceSec).toBeCloseTo(89.9 + (p.t - 9.9), 9);
      expect(p.overlays).toEqual(['v14-a1-scratch']);
      expect(p.exportRect).toEqual({ x: 2790, y: 1256, width: 1050, height: 840 });
    }
    expect(plan.probes[0].frame).toBe(629);
    const reasons = plan.skipped.map((s) => `${s.from}-${s.to} ${s.reason}`);
    expect(reasons).toEqual([
      '0-5.4 under the cutaway shot "v14-a1-one-word"',
      '5.4-9.9 under the cutaway shot "v14-a1-template"',
      '23.15-30 under the cutaway shot "v14-a2-starter"',
    ]);
  });

  it('a plain timeline spreads probes over the whole clip; no camera clip → no reference', () => {
    const plain = project([], [{ id: 'c', kind: 'video', assetId: 'cam', start: 0, duration: 30, sourceIn: 12 }]);
    const plan = planSyncProbes(plain, { durationSec: 30, fps: 30, output: OUT_4K, count: 4 });
    // Starts 0.25 … 27.75 (27.5 s), four evenly spaced centres, snapped to frames.
    expect(plan.probes.map((p) => p.frame)).toEqual([111, 317, 523, 729]);
    expect(plan.probes[0].sourceSec).toBeCloseTo(15.7, 9);
    expect(plan.skipped).toEqual([]);
    const none = project([], [{ id: 'c', kind: 'image', assetId: 'cam', start: 0, duration: 30 }]);
    expect(planSyncProbes(none, { durationSec: 30, fps: 30, output: OUT_4K }).reference).toBeNull();
  });

  it('skips sped-up, rotated and faded camera clips and clips shorter than the window, with reasons', () => {
    const p = project([], [
      { id: 'fast', kind: 'video', assetId: 'cam', start: 0, duration: 10, speed: 2 },
      { id: 'rot', kind: 'video', assetId: 'cam', start: 10, duration: 5, transform: { rotation: 5 } },
      { id: 'fade', kind: 'video', assetId: 'cam', start: 15, duration: 5, transform: { opacity: 0.5 } },
      { id: 'short', kind: 'video', assetId: 'cam', start: 20, duration: 2 },
      { id: 'ok', kind: 'video', assetId: 'cam', start: 22, duration: 8, sourceIn: 0 },
    ]);
    const plan = planSyncProbes(p, { durationSec: 30, fps: 30, output: OUT_4K, count: 3 });
    expect(plan.probes.every((x) => x.clipId === 'ok')).toBe(true);
    expect(plan.skipped.map((s) => s.reason)).toEqual([
      'camera clip at speed ×2',
      'camera picture rotated',
      'camera picture faded (opacity 0.5)',
      'camera clip shorter than the 2 s audio window',
    ]);
  });

  it('an image above the camera covers it only where its box meets the camera picture', () => {
    const logo = { id: 'logo', path: 'D:/logo.png', probe: { width: 400, height: 400 } };
    const shots: ClipSpec[] = [{ id: 'l', kind: 'image', assetId: 'logo', start: 0, duration: 10, transform: { x: -1700, y: -900, scale: 0.05 } }];
    const pip = project(shots, [{ id: 'c', kind: 'video', assetId: 'cam', start: 0, duration: 10, transform: PIP }], [logo]);
    expect(planSyncProbes(pip, { durationSec: 10, fps: 60, output: OUT_4K }).skipped).toEqual([]);
    const full = project(shots, [{ id: 'c', kind: 'video', assetId: 'cam', start: 0, duration: 10 }], [logo]);
    const plan = planSyncProbes(full, { durationSec: 10, fps: 60, output: OUT_4K });
    expect(plan.probes).toHaveLength(0);
    expect(plan.skipped).toEqual([{ from: 0, to: 10, reason: 'under the image clip "l"' }]);
  });
});
