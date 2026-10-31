/**
 * The files one Studio export's browser renders read, for the disk estimate
 * (`disk-estimate.ts`): Remotion copies each one whole into its assets folder,
 * however short the range. Pure — the caller stats the paths.
 *
 * - a video clip reads the entry's file for its asset (a proxy when the export
 *   renders from proxies, else the original) and shows its picture;
 * - a video asset with sound is also read from its ORIGINAL when the entry's
 *   file is a proxy (the audio pass reads the originals regardless);
 * - an audio clip reads its original;
 * - images are fetched by the browser, never copied; shots (`tsx`) only add
 *   Fastest's layer, one contiguous run of shots at a time.
 */
import type { StudioProject } from '../../../../shared/types/studio';
import type { StudioExportEntry } from '../export-entry';

export interface DiskSourceFile {
  path: string;
  /** The asset's probed length in seconds (0 when unknown). */
  durationSeconds: number;
  /** Timeline seconds that show this file's picture. */
  videoSeconds: number;
}

export interface ExportDiskSources {
  files: DiskSourceFile[];
  /** The longest contiguous run of timeline seconds under shots. */
  longestShotRunSeconds: number;
}

export function exportDiskSources(
  project: Pick<StudioProject, 'assets' | 'timeline'>,
  entry: Pick<StudioExportEntry, 'sourcePaths'>,
): ExportDiskSources {
  const assets = new Map((project.assets ?? []).map((a) => [a.id, a]));
  const files = new Map<string, DiskSourceFile>();
  const touch = (filePath: string, durationSeconds: number, videoSeconds: number) => {
    const key = filePath.toLowerCase();
    const file = files.get(key) ?? { path: filePath, durationSeconds, videoSeconds: 0 };
    file.videoSeconds += videoSeconds;
    files.set(key, file);
  };
  const shots: Array<{ start: number; end: number }> = [];

  for (const track of project.timeline?.tracks ?? []) {
    for (const clip of track.clips) {
      const length = Math.max(0, clip.duration);
      if (clip.kind === 'tsx') {
        shots.push({ start: clip.timelineStart, end: clip.timelineStart + length });
        continue;
      }
      const asset = clip.assetId ? assets.get(clip.assetId) : undefined;
      if (!asset || asset.kind === 'image') continue;
      const duration = asset.probe?.duration ?? 0;
      if (asset.kind === 'audio' || clip.kind === 'audio') {
        touch(asset.path, duration, 0);
        continue;
      }
      if (clip.kind !== 'video') continue;
      const entryFile = entry.sourcePaths?.[asset.id] ?? asset.path;
      touch(entryFile, duration, length);
      if (entryFile !== asset.path && asset.probe?.hasAudio) touch(asset.path, duration, 0);
    }
  }
  return { files: [...files.values()], longestShotRunSeconds: longestRun(shots) };
}

function longestRun(spans: Array<{ start: number; end: number }>): number {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let longest = 0;
  let run: { start: number; end: number } | null = null;
  for (const span of sorted) {
    if (run && span.start <= run.end + 1e-6) {
      run.end = Math.max(run.end, span.end);
    } else {
      run = { ...span };
    }
    longest = Math.max(longest, run.end - run.start);
  }
  return longest;
}
