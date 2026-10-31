/**
 * The export disk preflight's verdict (docs/studio/END_TO_END_PLAN.md §2 T7, part A2):
 * the estimate (`disk-estimate.ts`) against the free space of the output drive and the
 * `%TEMP%` drive. When both are one volume their needs add up. A refusal carries the
 * numbers — what each drive needs, of which what, and what it has.
 */
import type { ExportDiskEstimate } from './disk-estimate';

/** Room left over on every drive the export writes to: Windows and the app keep working. */
export const DISK_HEADROOM_BYTES = 512 * 1024 ** 2;

export interface DiskVolume {
  /** Identifies the volume (the drive's `stat.dev`): output and temp on one volume share it. */
  key: string;
  /** What the user calls it: "C:" or the folder on a drive without a letter. */
  label: string;
  freeBytes: number;
}

export interface DriveCheck {
  label: string;
  needBytes: number;
  freeBytes: number;
  uses: Array<'output' | 'temp'>;
  fits: boolean;
}

export type DiskPreflightVerdict =
  | { ok: true; drives: DriveCheck[] }
  | { ok: false; drives: DriveCheck[]; message: string };

export function diskPreflightVerdict(
  estimate: ExportDiskEstimate,
  volumes: { output: DiskVolume; temp: DiskVolume },
  headroomBytes = DISK_HEADROOM_BYTES,
): DiskPreflightVerdict {
  const drives = new Map<string, DriveCheck>();
  const add = (use: 'output' | 'temp', volume: DiskVolume, bytes: number) => {
    const drive = drives.get(volume.key) ?? { label: volume.label, needBytes: 0, freeBytes: volume.freeBytes, uses: [], fits: true };
    drive.needBytes += bytes;
    drive.uses.push(use);
    drives.set(volume.key, drive);
  };
  add('temp', volumes.temp, estimate.tempBytes);
  add('output', volumes.output, estimate.outputBytes);
  const checks = [...drives.values()].map((d) => ({ ...d, fits: d.needBytes + headroomBytes <= d.freeBytes }));
  const short = checks.filter((d) => !d.fits);
  if (short.length === 0) return { ok: true, drives: checks };
  const lines = short.map((d) => driveLine(d, estimate, headroomBytes));
  return { ok: false, drives: checks, message: `Not enough disk space for this export. ${lines.join(' ')}` };
}

function driveLine(drive: DriveCheck, estimate: ExportDiskEstimate, headroomBytes: number): string {
  const parts: string[] = [];
  if (drive.uses.includes('temp')) parts.push(`temporary files ${formatBytes(estimate.tempBytes)} (${tempParts(estimate)})`);
  if (drive.uses.includes('output')) parts.push(`the finished file ${formatBytes(estimate.outputBytes)}`);
  return `${drive.label} needs about ${formatBytes(drive.needBytes + headroomBytes)} free — ${parts.join(' + ')} + ${formatBytes(headroomBytes)} to spare — and has ${formatBytes(drive.freeBytes)}.`;
}

function tempParts(estimate: ExportDiskEstimate): string {
  const { remotionCopies, intermediate, audio, shotLayers } = estimate.temp;
  return [
    remotionCopies > 0 ? `copies of the sources ${formatBytes(remotionCopies)}` : '',
    intermediate > 0 ? `rendered video ${formatBytes(intermediate)}` : '',
    audio > 0 ? `audio ${formatBytes(audio)}` : '',
    shotLayers > 0 ? `shot layer ${formatBytes(shotLayers)}` : '',
  ].filter(Boolean).join(', ');
}

/** "3.8 GB" / "412 MB" / "12 KB", in Explorer's units (1 GB = 1024³ bytes). */
export function formatBytes(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  if (mb >= 1) return `${Math.round(mb)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}
