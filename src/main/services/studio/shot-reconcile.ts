// Reconcile shots/ folders against the registry (SHOT_QUALITY_DESIGN.md Q1c).
//
// One mechanism, two masters: crash orphans (a generation wrote files but the
// registry entry never reached a saved document) and linked-folder drop-ins
// (a Creator composition dragged into shots/ — Q2). The renderer calls this on
// project open and window focus with the ids it already has (it owns the
// document); main scans shots/ for folders the registry doesn't know, runs the
// newest version through the SAME acceptance gate imports use (D14), and
// publishes adoptions on the shared shot job-event stream — house rule: shot
// producers publish there, never a new push channel. The IPC response only
// summarizes for the toast; the events are the adoption path.
//
// Failures are never adopted and never minted as error registry entries: a
// hard-fail drop-in would re-add a junk pool card on every focus rescan.
// They're returned for the banner instead — conformable ones with the source
// path so the existing "Convert for Studio" flow (useShotImport) can re-enter
// importShot with conform:true. A per-process memo suppresses re-reporting the
// same failed folder within a session; a restart honestly reminds again.
//
// Folders with no v*.tsx are skipped silently: that is the reserved-but-not-
// yet-written window of an in-flight generation or conform run.
//
// Focus fires often and the gate transpiles, so a scan is fingerprinted
// (video-10 feedback item 2): the known ids plus, for every folder the
// registry doesn't know, its newest version file's size and mtime. When that
// is unchanged since this project's last complete scan, nothing on disk or in
// the registry could produce a different answer — the scan returns empty
// without reading or validating anything (adoptions were already published,
// failures already reported).

import fs from 'fs/promises';
import path from 'path';
import type { StudioShot } from '../../../shared/types/studio';
import { classifyShotImport, describeImportFailure } from '../../../shared/studio/shot-import';
import { isValidShotId } from '../../../shared/studio/shots';
import { validateShotCode } from './shot-generator';
import { buildImportedShot } from './shot-import';
import { shotJobEvents } from './shot-job-events';
import { getProjectDir } from './studio-paths';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('ShotReconcile');

export interface ReconcileShotFailure {
  shotId: string;
  /** Newest version file — what "Convert for Studio" re-enters importShot with. */
  sourcePath: string;
  error: string;
  /** The only problem is the allowlist gap — Convert is worth offering. */
  conformable: boolean;
}

export interface ReconcileShotsResult {
  /** Registry entries adopted this scan (also published as job events). */
  adopted: StudioShot[];
  /** New failures this scan — already-reported folders are suppressed. */
  failures: ReconcileShotFailure[];
}

/** Failed folders already reported this session, per project. */
const reportedFailures = new Map<string, Set<string>>();

/** Fingerprint of each project's last complete scan. */
const lastScanFingerprint = new Map<string, string>();

/** Focus events burst; coalesce concurrent scans per project. */
const inFlight = new Map<string, Promise<ReconcileShotsResult>>();

async function newestVersion(
  folderPath: string,
): Promise<{ version: number; filePath: string } | null> {
  let entries: string[];
  try {
    entries = await fs.readdir(folderPath);
  } catch {
    return null;
  }
  const versions = entries
    .map((entry) => /^v(\d+)\.tsx$/.exec(entry)?.[1])
    .filter((v): v is string => v !== undefined)
    .map(Number)
    .sort((a, b) => a - b);
  const version = versions[versions.length - 1];
  if (version === undefined) return null;
  return { version, filePath: path.join(folderPath, `v${version}.tsx`) };
}

export interface ReconcileCandidate {
  shotId: string;
  version: number;
  size: number;
  mtimeMs: number;
}

/** Order-insensitive identity of a scan's inputs. */
export function reconcileFingerprint(
  knownShotIds: readonly string[],
  candidates: readonly ReconcileCandidate[],
): string {
  const known = [...knownShotIds].sort();
  const folders = [...candidates]
    .sort((a, b) => a.shotId.localeCompare(b.shotId))
    .map((c) => `${c.shotId}@${c.version}:${c.size}:${c.mtimeMs}`);
  return JSON.stringify({ known, folders });
}

export function reconcileShots(
  projectId: string,
  knownShotIds: readonly string[],
): Promise<ReconcileShotsResult> {
  const running = inFlight.get(projectId);
  if (running) return running;
  const scan = runScan(projectId, knownShotIds).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, scan);
  return scan;
}

async function runScan(
  projectId: string,
  knownShotIds: readonly string[],
): Promise<ReconcileShotsResult> {
  const shotsDir = path.join(await getProjectDir(projectId), 'shots');
  const known = new Set(knownShotIds);
  const adopted: StudioShot[] = [];
  const failures: ReconcileShotFailure[] = [];

  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(shotsDir, { withFileTypes: true });
  } catch {
    return { adopted, failures }; // No shots/ folder yet — nothing to do.
  }

  const candidates: Array<ReconcileCandidate & { filePath: string }> = [];
  for (const entry of entries) {
    const shotId = entry.name;
    // Folder names outside the id pattern can't become registry ids (they'd
    // fail the path-safety checks everywhere else) — leave them alone.
    if (!entry.isDirectory() || !isValidShotId(shotId) || known.has(shotId)) continue;

    const newest = await newestVersion(path.join(shotsDir, shotId));
    if (!newest) continue; // Reserved-but-empty: an in-flight producer owns it.
    try {
      const stat = await fs.stat(newest.filePath);
      candidates.push({ shotId, version: newest.version, size: stat.size, mtimeMs: stat.mtimeMs, filePath: newest.filePath });
    } catch {
      // Vanished between readdir and stat — the next scan sees the new state.
    }
  }

  const fingerprint = reconcileFingerprint(knownShotIds, candidates);
  if (lastScanFingerprint.get(projectId) === fingerprint) return { adopted, failures };
  let complete = true;

  for (const candidate of candidates) {
    const { shotId } = candidate;
    let code: string;
    try {
      code = await fs.readFile(candidate.filePath, 'utf-8');
    } catch {
      complete = false; // A locked file must be retried on the next focus.
      continue;
    }

    const gate = await validateShotCode(code);
    if (gate.success) {
      const shot = buildImportedShot(shotId, deriveDisplayName(shotId), code, candidate.version);
      shotJobEvents.emit({ projectId, shotId, op: 'import', status: 'ready', shot });
      adopted.push(shot);
      reportedFailures.get(projectId)?.delete(shotId);
      log.info('Adopted shot from disk', { projectId, shotId, version: candidate.version });
      continue;
    }

    const seen = reportedFailures.get(projectId) ?? new Set<string>();
    reportedFailures.set(projectId, seen);
    if (seen.has(shotId)) continue;
    seen.add(shotId);
    const classification = classifyShotImport(code);
    failures.push({
      shotId,
      sourcePath: candidate.filePath,
      error: describeImportFailure(classification, gate.error ?? 'Failed the shot gate'),
      conformable: classification.canConform,
    });
    log.warn('Unadoptable shot folder', { projectId, shotId, conformable: classification.canConform });
  }

  if (complete) lastScanFingerprint.set(projectId, fingerprint);
  else lastScanFingerprint.delete(projectId);
  return { adopted, failures };
}

/** The folder name IS the slug of the shot's original display name
 *  (reserveProjectFolder derives it that way), so unslugging recovers a
 *  decent name: "intro-title" → "Intro Title". */
function deriveDisplayName(shotId: string): string {
  return shotId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
