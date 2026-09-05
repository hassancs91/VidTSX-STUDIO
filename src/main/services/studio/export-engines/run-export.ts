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
    // own when it made one in the same pass, else rendered here.
    options.onProgress('finishing', 0, undefined, 'Mixing audio…');
    let audioPath = product.audioPath;
    if (!audioPath) {
      audioPath = path.join(workDir, 'audio.wav');
      await renderTimelineAudio({
        bundleUrl: options.bundleUrl,
        entry,
        outputPath: audioPath,
        render: options.render,
        signal,
        onProgress: (fraction) => options.onProgress('finishing', Math.round(fraction * 80), undefined, 'Mixing audio…'),
      });
    }
    const audioDoneAt = Date.now();

    // 3. Mux under the colour policy.
    options.onProgress('finishing', 80, undefined, 'Writing the file…');
    await finishExport({
      videoPath: product.videoPath,
      audioPath,
      outputPath: options.outputPath,
      color: EXPORT_COLOR,
      signal,
      onProgress: (fraction) => options.onProgress('finishing', 80 + Math.round(fraction * 20), undefined, 'Writing the file…'),
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
      options.onProgress('verifying', 0, undefined, 'Rendering the reference export…');
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
        onProgress: (fraction, note) => options.onProgress('verifying', Math.round(fraction * 100), undefined, note),
      });
      reportPath = verified.reportPath;
      message = [message, summaryLine(verified.report)].filter(Boolean).join(' ');
      log.info('Export verified', { jobId: options.jobId, reportPath, summary: verified.report.summary });
    }

    const stat = await fs.stat(options.outputPath);
    return { outputPath: options.outputPath, fileSize: stat.size, message, reportPath };
  } finally {
    active.delete(options.jobId);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
