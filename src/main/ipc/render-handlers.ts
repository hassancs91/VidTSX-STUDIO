import type { IpcMainInvokeEvent } from 'electron';
import { shell } from 'electron';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('Render');
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { renderComposition, cancelRender, getActiveJobs } from '../services/remotion-renderer';
import {
  listQueueJobs,
  saveQueueJobs,
  listHistoryEntries,
  appendHistoryEntry,
} from '../services/render-queue-db';
import { bundleComposition, getBundlerPort } from '../services/remotion-bundler';
import { detectToneImport, extractToneAudio } from '../services/tone-audio-extractor';
import {
  isCaptionComposition,
  isBurnInComposition,
  extractStyleIdFromCompositionId,
  createCaptionEntry,
} from '../services/caption-composition';
import { generateThumbnail } from '../services/thumbnail-generator';
import { getOutputFolder, getRenderTimeoutSeconds, getRenderDefaultGpuBackend, getRenderDefaultHardwareAcceleration } from '../services/settings';
import { IPC } from '../../shared/ipc/channels';
import type {
  RenderStartRequest,
  RenderStartResponse,
  RenderCancelRequest,
  RenderCancelResponse,
  RenderQueueGetRequest,
  RenderQueueGetResponse,
  RenderQueueSaveRequest,
  RenderQueueSaveResponse,
  RenderQueueLoadResponse,
  RenderOpenFileRequest,
  RenderOpenFileResponse,
  RenderOpenFolderRequest,
  RenderOpenFolderResponse,
  RenderGetVideosDirResponse,
  RenderHistoryLoadResponse,
  RenderHistoryAppendRequest,
  RenderHistoryAppendResponse,
} from '../../shared/ipc/types';

export async function handleRenderStart(
  event: IpcMainInvokeEvent,
  data: RenderStartRequest
): Promise<RenderStartResponse> {
  // Validate required fields synchronously — return error fast if malformed
  if (!data.compositionId || !data.outputPath) {
    return {
      success: false,
      error: 'Missing required fields: compositionId or outputPath',
    };
  }

  // Generate jobId up front and return it immediately.
  // All prep work (tone extraction, bundling, render) runs detached.
  // Progress and completion flow through IPC events on the existing channels.
  const jobId = randomUUID();
  const webContents = event.sender;

  const sendProgress = (percent: number, phase: 'preparing' | 'extracting_audio' | 'bundling' | 'rendering', message?: string, framesRendered?: number, totalFrames?: number): void => {
    if (webContents.isDestroyed()) return;
    webContents.send(IPC.RENDER_PROGRESS, {
      jobId,
      phase,
      percent,
      framesRendered,
      totalFrames,
      message,
    });
  };

  const sendComplete = (success: boolean, outputPath?: string, fileSize?: number, error?: string): void => {
    if (webContents.isDestroyed()) return;
    webContents.send(IPC.RENDER_COMPLETE, { jobId, success, outputPath, fileSize, error });
  };

  const sendEncoderResolved = (encoderName: string, hardwareAccelerated: boolean): void => {
    if (webContents.isDestroyed()) return;
    webContents.send(IPC.RENDER_ENCODER_RESOLVED, { jobId, encoderName, hardwareAccelerated });
  };

  // Fire immediate "preparing" event so the UI stops showing stuck 0%
  sendProgress(0, 'preparing', 'Preparing...');

  // Kick off the full prep + render flow in a detached async IIFE.
  // We intentionally do NOT await this — the IPC call returns the jobId
  // right after this line, and the caller observes progress via events.
  void (async () => {
    let bundleUrl = data.bundleUrl;
    let captionDurationInFrames: number | undefined;
    let toneCleanup: (() => Promise<void>) | undefined;
    let bundleCompositions: Array<{ id: string; width: number; height: number; fps: number; durationInFrames: number }> | undefined;

    try {
      if (!bundleUrl) {
        // Caption composition path
        if (isCaptionComposition(data.compositionId)) {
          log.debug('Detected caption composition', { compositionId: data.compositionId });

          const styleId = extractStyleIdFromCompositionId(data.compositionId);
          const mode = isBurnInComposition(data.compositionId) ? 'burnin' : 'overlay';

          let durationInFrames = 300;
          const inputProps = data.inputProps as {
            segments?: Array<{ start: number; end: number; text: string }>;
            videoPath?: string;
          } | undefined;
          if (inputProps?.segments && inputProps.segments.length > 0) {
            const lastSegment = inputProps.segments[inputProps.segments.length - 1];
            durationInFrames = Math.ceil((lastSegment.end + 1) * data.fps);
          }
          captionDurationInFrames = durationInFrames;

          const { entryPath, cleanup } = await createCaptionEntry({
            styleId,
            mode,
            compositionId: data.compositionId,
            width: data.width,
            height: data.height,
            fps: data.fps,
            durationInFrames,
            videoPath: inputProps?.videoPath,
            bundlerPort: getBundlerPort() ?? 3100,
            segments: inputProps?.segments,
          });

          sendProgress(0, 'bundling', 'Bundling caption composition...');
          const bundleResult = await bundleComposition(entryPath, {
            skipWrapper: true,
            onProgress: (percent) => sendProgress(Math.round(percent * 100), 'bundling', 'Bundling caption composition...'),
          });
          await cleanup();

          if (!bundleResult.success || !bundleResult.serveUrl) {
            sendComplete(false, undefined, undefined, bundleResult.error || 'Caption bundling failed');
            return;
          }
          bundleUrl = bundleResult.serveUrl;
          bundleCompositions = bundleResult.compositions;
          log.debug('Caption bundle complete', { bundleUrl });
        } else {
          // Standard user TSX path
          if (!data.filePath) {
            sendComplete(false, undefined, undefined, 'Missing required field: filePath or bundleUrl');
            return;
          }

          // Tone.js audio extraction (emits extracting_audio phase progress)
          let toneAudioPath: string | undefined;
          try {
            const tsxContent = await fs.readFile(data.filePath, 'utf-8');
            if (detectToneImport(tsxContent)) {
              log.info('Detected Tone.js import, extracting audio', { filePath: data.filePath });
              sendProgress(0, 'extracting_audio', 'Extracting audio...');
              const extraction = await extractToneAudio({
                filePath: data.filePath,
                durationSeconds: 10,
                fps: data.fps || 30,
                width: data.width,
                height: data.height,
                onProgress: (percent) => sendProgress(percent, 'extracting_audio', 'Extracting audio...'),
              });
              if (extraction.success && extraction.wavPath) {
                toneAudioPath = extraction.wavPath;
                toneCleanup = extraction.cleanup;
                log.info('Tone.js audio extracted', { wavPath: extraction.wavPath });
              } else {
                log.warn('Tone.js audio extraction failed, rendering without audio', { error: extraction.error });
              }
            }
          } catch (toneErr) {
            log.warn('Tone.js detection failed, rendering normally', {
              error: toneErr instanceof Error ? toneErr.message : String(toneErr),
            });
          }

          sendProgress(0, 'bundling', 'Bundling composition...');
          const bundleResult = await bundleComposition(data.filePath, {
            toneAudioPath,
            onProgress: (percent) => sendProgress(Math.round(percent * 100), 'bundling', 'Bundling composition...'),
          });
          if (!bundleResult.success || !bundleResult.serveUrl) {
            if (toneCleanup) toneCleanup().catch(() => {});
            sendComplete(false, undefined, undefined, bundleResult.error || 'Bundling failed');
            return;
          }
          bundleUrl = bundleResult.serveUrl;
          bundleCompositions = bundleResult.compositions;
          log.debug('Bundle complete', { bundleUrl });
        }
      }

      // Pull composition metadata from bundle result to skip selectComposition's Chromium launch
      let renderWidth = data.width || 1920;
      let renderHeight = data.height || 1080;
      let renderFps = data.fps || 30;
      let renderDurationInFrames = captionDurationInFrames;
      if (!renderDurationInFrames && bundleCompositions) {
        const matched = bundleCompositions.find((c) => c.id === data.compositionId);
        if (matched) {
          renderWidth = matched.width;
          renderHeight = matched.height;
          renderFps = matched.fps;
          renderDurationInFrames = matched.durationInFrames;
        }
      }

      sendProgress(0, 'rendering', 'Starting render...');

      const renderTimeoutSeconds = await getRenderTimeoutSeconds();
      // Per-render override wins over the persisted Settings default.
      const gpuBackend = data.gpuBackend ?? (await getRenderDefaultGpuBackend());
      const hardwareAcceleration = data.hardwareAcceleration ?? (await getRenderDefaultHardwareAcceleration());

      await renderComposition(
        {
          bundleUrl,
          compositionId: data.compositionId,
          outputPath: data.outputPath,
          codec: data.codec || 'h264',
          width: renderWidth,
          height: renderHeight,
          fps: renderFps,
          crf: data.crf,
          muted: data.muted,
          scale: data.scale,
          everyNthFrame: data.everyNthFrame,
          numberOfGifLoops: data.numberOfGifLoops,
          inputProps: data.inputProps,
          durationInFrames: renderDurationInFrames,
          transparent: data.transparent,
          cpuUsage: data.cpuUsage,
          gpuBackend,
          hardwareAcceleration,
          timeoutInMilliseconds: renderTimeoutSeconds * 1000,
        },
        (progressEvent) => {
          sendProgress(
            progressEvent.percent,
            'rendering',
            undefined,
            progressEvent.framesRendered,
            progressEvent.totalFrames
          );
        },
        (completeEvent) => {
          sendComplete(completeEvent.success, completeEvent.outputPath, completeEvent.fileSize, completeEvent.error);
          if (completeEvent.success && completeEvent.outputPath && data.filePath) {
            generateThumbnail(completeEvent.outputPath, data.filePath).then((thumbPath) => {
              if (thumbPath && !webContents.isDestroyed()) {
                webContents.send(IPC.THUMBNAIL_READY, {
                  jobId: completeEvent.jobId,
                  tsxFilePath: data.filePath,
                  thumbnailPath: thumbPath,
                });
              }
            });
          }
          if (toneCleanup) toneCleanup().catch(() => {});
        },
        jobId,
        (info) => sendEncoderResolved(info.encoderName, info.hardwareAccelerated)
      );
    } catch (err) {
      if (toneCleanup) toneCleanup().catch(() => {});
      sendComplete(false, undefined, undefined, err instanceof Error ? err.message : String(err));
    }
  })();

  return { success: true, jobId };
}

export async function handleRenderCancel(
  _event: IpcMainInvokeEvent,
  data: RenderCancelRequest
): Promise<RenderCancelResponse> {
  try {
    if (!data.jobId) {
      return { success: false, error: 'Missing jobId' };
    }

    const cancelled = cancelRender(data.jobId);
    if (!cancelled) {
      return { success: false, error: 'Job not found or already completed' };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to cancel render';
    return { success: false, error };
  }
}

export async function handleRenderQueueGet(
  _event: IpcMainInvokeEvent,
  _data: RenderQueueGetRequest
): Promise<RenderQueueGetResponse> {
  try {
    const jobs = getActiveJobs();
    return { jobs };
  } catch (err) {
    return { jobs: [] };
  }
}

export async function handleRenderQueueSave(
  _event: IpcMainInvokeEvent,
  data: RenderQueueSaveRequest
): Promise<RenderQueueSaveResponse> {
  try {
    saveQueueJobs(data.jobs);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save render queue';
    log.warn('Failed to save render queue', { err: error });
    return { success: false, error };
  }
}

export async function handleRenderQueueLoad(
  _event: IpcMainInvokeEvent
): Promise<RenderQueueLoadResponse> {
  try {
    // listQueueJobs persists the "mark interrupted rendering jobs as error" and
    // "drop jobs older than 7 days" cleanups inside the DB — matches the legacy behavior.
    const jobs = listQueueJobs();
    return { jobs };
  } catch (err) {
    log.warn('Failed to load render queue', {
      err: err instanceof Error ? err.message : String(err),
    });
    return { jobs: [] };
  }
}

export async function handleRenderOpenFile(
  _event: IpcMainInvokeEvent,
  data: RenderOpenFileRequest
): Promise<RenderOpenFileResponse> {
  try {
    if (!data.filePath) {
      return { success: false, error: 'Missing filePath' };
    }

    const result = await shell.openPath(data.filePath);
    if (result) {
      // openPath returns an error string if failed, empty string on success
      return { success: false, error: result };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to open file';
    return { success: false, error };
  }
}

export async function handleRenderOpenFolder(
  _event: IpcMainInvokeEvent,
  data: RenderOpenFolderRequest
): Promise<RenderOpenFolderResponse> {
  try {
    if (!data.filePath) {
      return { success: false, error: 'Missing filePath' };
    }

    shell.showItemInFolder(data.filePath);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to open folder';
    return { success: false, error };
  }
}

export async function handleRenderGetVideosDir(
  _event: IpcMainInvokeEvent
): Promise<RenderGetVideosDirResponse> {
  const videosDir = await getOutputFolder();
  return { path: videosDir };
}

export async function handleRenderHistoryLoad(
  _event: IpcMainInvokeEvent
): Promise<RenderHistoryLoadResponse> {
  try {
    const entries = listHistoryEntries();
    const verified = await Promise.all(
      entries.map(async (entry) => {
        let exists = false;
        if (entry.outputPath) {
          try {
            const stat = await fs.stat(entry.outputPath);
            exists = stat.isFile();
          } catch {
            exists = false;
          }
        }
        return { ...entry, exists };
      })
    );
    return { entries: verified };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to load render history';
    return { entries: [], error };
  }
}

export async function handleRenderHistoryAppend(
  _event: IpcMainInvokeEvent,
  data: RenderHistoryAppendRequest
): Promise<RenderHistoryAppendResponse> {
  try {
    if (!data.entry || !data.entry.filePath || !data.entry.outputPath) {
      return { success: false, error: 'Missing entry fields' };
    }
    appendHistoryEntry(data.entry);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to append render history';
    return { success: false, error };
  }
}
