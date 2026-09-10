/**
 * One Studio export, end to end: engine → audio pass → finishing stage
 * (→ verification in dev). Owns the scratch folder and the cancel signal;
 * the render handler owns the IPC events and the queue record.
 */
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../../../logging/log-engine';
import { getTempDir } from '../../../utils/paths';
import type { ExportEngineId } from '../../../../shared/studio/export-engines';
import type { RenderPhase } from '../../../../shared/ipc/types';
import type { StudioProject } from '../../../../shared/types/studio';
import type { StudioExportEntry } from '../export-entry';
import { renderTimelineAudio } from './audio-pass';
import { finishExport } from './finishing';
import { resolveExportEngine } from './registry';
import { EXPORT_COLOR, type ExportRenderSettings } from './types';
import { summaryLine, verifyExport } from './verify';

const log = logEngine.createLogger('StudioExportRun');

export interface StudioExportRunOptions {
  jobId: string;
  engineId: ExportEngineId;
  verifyAgainstEngine?: ExportEngineId;
  project: StudioProject;
  entry: StudioExportEntry;
  bundleUrl: string;
  outputPath: string;
  render: ExportRenderSettings;
  onProgress: (phase: RenderPhase, percent: number, frames?: { done: number; total: number }, message?: string) => void;
  onEncoderResolved?: (info: { encoderName: string; hardwareAccelerated: boolean }) => void;
}

export interface StudioExportResult {
  outputPath: string;
  fileSize: number;
  message?: string;
  reportPath?: string;
}

const active = new Map<string, AbortController>();

export function cancelStudioExport(jobId: string): boolean {
  const controller = active.get(jobId);
  if (!controller) return false;
  controller.abort();
  return true;
}

export function isStudioExportActive(jobId: string): boolean {
  return active.has(jobId);
}

/** Verification is a development instrument (D5), never a shipped option. */
export function isExportVerifyAvailable(): boolean {
  return !app.isPackaged || process.env.VIDTSX_EXPORT_VERIFY === '1';
}

export async function runStudioExport(options: StudioExportRunOptions): Promise<StudioExportResult> {
  const controller = new AbortController();
  active.set(options.jobId, controller);
  const { signal } = controller;
  const workDir = path.join(getTempDir(), 'export', options.jobId);
  await fs.mkdir(workDir, { recursive: true });
  const startedAt = Date.now();

  try {
    const engine = resolveExportEngine(options.engineId);
    const { entry } = options;

    // 1. Frames — the engine's job.
    options.onProgress('rendering', 0, { done: 0, total: entry.durationInFrames });
    const product = await engine.produce({
      jobId: options.jobId,
      project: options.project,
      entry,
      bundleUrl: options.bundleUrl,
      workDir,
      render: options.render,
      color: EXPORT_COLOR,
      signal,
      onProgress: (p) => {
        const percent = p.totalFrames > 0 ? Math.round((p.framesDone / p.totalFrames) * 100) : 0;
        options.onProgress('rendering', percent, { done: p.framesDone, total: p.totalFrames }, p.message);
      },
      onEncoderResolved: options.onEncoderResolved,
    });
    const framesDoneAt = Date.now();

    // 2. The one audio pass over the whole timeline (D6/D7) — the engine's
    // own when it made one in the same pass, else rendered here. The frame
    // counts stay on every later tick: the queue row persists the last one.
    const allFrames = { done: entry.durationInFrames, total: entry.durationInFrames };
    options.onProgress('finishing', 0, allFrames, 'Mixing audio…');
    let audioPath = product.audioPath;
    if (!audioPath) {
      audioPath = path.join(workDir, 'audio.wav');
      await renderTimelineAudio({
        bundleUrl: options.bundleUrl,
        entry,
        outputPath: audioPath,
        render: options.render,
        signal,
        onProgress: (fraction) => options.onProgress('finishing', Math.round(fraction * 80), allFrames, 'Mixing audio…'),
      });
    }
    const audioDoneAt = Date.now();

    // 3. Mux under the colour policy.
    options.onProgress('finishing', 80, allFrames, 'Writing the file…');
    await finishExport({
      videoPath: product.videoPath,
      audioPath,
      outputPath: options.outputPath,
      color: EXPORT_COLOR,
      fps: entry.fps,
      signal,
      onProgress: (fraction) => options.onProgress('finishing', 80 + Math.round(fraction * 20), allFrames, 'Writing the file…'),
    });
    log.info('Export finished', {
      jobId: options.jobId,
      engine: options.engineId,
      frames: entry.durationInFrames,
      framesMs: framesDoneAt - startedAt,
      audioPassMs: audioDoneAt - framesDoneAt,
      muxMs: Date.now() - audioDoneAt,
    });

    // 4. Dev verification (D5).
    let message = product.notes?.join(' ');
    let reportPath: string | undefined;
    if (options.verifyAgainstEngine && isExportVerifyAvailable()) {
      options.onProgress('verifying', 0, allFrames, 'Rendering the reference export…');
      const verified = await verifyExport({
        jobId: options.jobId,
        project: options.project,
        entry,
        bundleUrl: options.bundleUrl,
        workDir,
        render: options.render,
        color: EXPORT_COLOR,
        signal,
        candidate: { engineId: options.engineId, outputPath: options.outputPath },
        referenceEngineId: options.verifyAgainstEngine,
        audioPath,
        onProgress: (fraction, note) => options.onProgress('verifying', Math.round(fraction * 100), allFrames, note),
      });
      reportPath = verified.reportPath;
      message = [message, summaryLine(verified.report)].filter(Boolean).join(' ');
      log.info('Export verified', { jobId: options.jobId, reportPath, summary: verified.report.summary });
    }

    const stat = await fs.stat(options.outputPath);
    return { outputPath: options.outputPath, fileSize: stat.size, message, reportPath };
  } finally {
    active.delete(options.jobId);
    await removeScratch(workDir, options.jobId);
    if (signal.aborted) {
      await fs.rm(options.outputPath, { force: true }).catch(() => {});
      await removeEmptyRemotionAssetDirs(startedAt);
    }
  }
}

/**
 * Remove an export's scratch folder (the TS pieces, the joined video, the
 * WAV, a browser span's intermediate). After a cancel the killed ffmpeg or
 * Remotion's own cleanup can still hold a file for a moment, and Windows
 * refuses the delete (EBUSY/EPERM), so this retries for a few seconds and
 * only then reports the leftover.
 */
async function removeScratch(dir: string, jobId: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.access(dir).then(() => { throw new Error('still there'); }, () => undefined);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  log.warn('Export scratch folder could not be removed', { jobId, dir });
}

/**
 * Startup sweep: scratch folders and Remotion's per-render asset copies
 * (`%TEMP%\remotion-v4…-assets…`, T5's leak) that a crash or a kill left
 * behind — no export of ours is running when the app starts, and a Remotion
 * asset folder untouched for an hour belongs to no live render.
 */
export async function sweepExportScratch(): Promise<{ scratch: number; remotionAssets: number }> {
  const result = { scratch: 0, remotionAssets: 0 };
  const root = path.join(getTempDir(), 'export');
  for (const name of await fs.readdir(root).catch(() => [] as string[])) {
    await fs.rm(path.join(root, name), { recursive: true, force: true }).then(() => { result.scratch++; }, () => {});
  }
  const staleBefore = Date.now() - 60 * 60 * 1000;
  for (const dir of await remotionAssetDirs()) {
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory() || stat.mtimeMs > staleBefore) continue;
    await fs.rm(dir, { recursive: true, force: true }).then(() => { result.remotionAssets++; }, () => {});
  }
  if (result.scratch > 0 || result.remotionAssets > 0) log.info('Swept export leftovers', result);
  return result;
}

async function remotionAssetDirs(): Promise<string[]> {
  const tmp = app.getPath('temp');
  const names = await fs.readdir(tmp).catch(() => [] as string[]);
  return names.filter((name) => /^remotion-v\d+\.\d+\.\d+-assets/.test(name)).map((name) => path.join(tmp, name));
}

/**
 * A cancelled browser span leaves Remotion's asset folder behind as an empty
 * tree (its cleanup removes the files, not the directories). Remove the
 * empty trees that appeared since this export started; a folder holding any
 * file belongs to a live render and is left alone.
 */
async function removeEmptyRemotionAssetDirs(since: number): Promise<void> {
  for (const dir of await remotionAssetDirs()) {
    const stat = await fs.stat(dir).catch(() => null);
    if (!stat?.isDirectory() || stat.birthtimeMs < since || !(await holdsNoFiles(dir))) continue;
    await fs.rm(dir, { recursive: true, force: true }).then(
      () => log.info('Removed a cancelled span\'s empty Remotion asset folder', { dir }),
      () => undefined,
    );
  }
}

async function holdsNoFiles(dir: string): Promise<boolean> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return false;
  for (const entry of entries) {
    if (!entry.isDirectory()) return false;
    if (!(await holdsNoFiles(path.join(dir, entry.name)))) return false;
  }
  return true;
}
