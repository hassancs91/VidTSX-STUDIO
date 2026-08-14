// Pure ops over the shot registry (TSX_SHOTS_DESIGN.md D9). Same discipline
// as every other op module: return the SAME array/object when the edit is
// rejected, so the reducer's commit() skips the undo step.

import type { StudioShot, StudioTimeline } from '../types';

/** Point the shot at another disk version (shots/<id>/v<version>.tsx). Disk
 *  versions are append-only, so undo/redo just flips this pointer back. */
export function setShotVersion(
  shots: StudioShot[],
  shotId: string,
  version: number,
): StudioShot[] {
  if (!Number.isInteger(version) || version < 1) return shots;
  const shot = shots.find((s) => s.id === shotId);
  if (!shot || shot.activeVersion === version) return shots;
  return shots.map((s) => (s.id === shotId ? { ...s, activeVersion: version } : s));
}

/** Drop a registry entry. Files stay on disk — no file deletion under any
 *  undoable action; folder-as-truth ignores unreferenced folders. */
export function removeShot(shots: StudioShot[], shotId: string): StudioShot[] {
  if (!shots.some((s) => s.id === shotId)) return shots;
  return shots.filter((s) => s.id !== shotId);
}

/** Remove every clip referencing a shot, on every track — the cascade half of
 *  delete-shot-with-clips (one undoable transaction with removeShot). */
export function removeClipsForShot(timeline: StudioTimeline, shotId: string): StudioTimeline {
  let changed = false;
  const tracks = timeline.tracks.map((track) => {
    const clips = track.clips.filter((c) => c.tsx?.shotId !== shotId);
    if (clips.length === track.clips.length) return track;
    changed = true;
    return { ...track, clips };
  });
  return changed ? { ...timeline, tracks } : timeline;
}
