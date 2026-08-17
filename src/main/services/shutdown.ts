/**
 * Ordered, idempotent teardown for every subsystem that owns state on disk or a
 * child process.
 *
 * This lives outside `app.on('will-quit')` on purpose. Electron does **not** await
 * async `will-quit` listeners, so an installer launched by the auto-updater could
 * otherwise start copying files while SQLite is still merging its WAL. Both the
 * quit path and the update path funnel through `gracefulShutdown()`, which runs
 * once and can be awaited.
 */

import { stopSystemMonitor } from './system-monitor';
import { pauseAllDownloads, flushState } from './download-manager';
import { closeDb as closeImageStudioDb } from './image-studio-db';
import { closeDb as closeVideoStudioDb } from './video-studio-db';
import { closeDb as closeTranscriptionDb } from './transcription-projects-db';
import { closeDb as closeRenderQueueDb } from './render-queue-db';
import { closeDb as closeSettingsDb } from './settings-db';
import { closeDb as closeAiUsageDb } from './ai-usage-db';
import { closeDb as closeFlowsProjectsDb } from './flows-projects-db';
import { closeDb as closeDownloadsDb } from './download-manager/download-state-db';
import { logEngine } from '../../logging/log-engine';

/** Past this, we stop waiting and let the process die rather than hang a quit. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shutdownPromise: Promise<void> | null = null;

async function runShutdown(): Promise<void> {
  stopSystemMonitor();

  // Stop update polling first — a check firing mid-teardown would push state to a
  // window that is on its way out.
  const { disposeUpdater } = await import('./updater/updater-service');
  disposeUpdater();

  // Abort TSX generation jobs (persists queued jobs) and tear down every LLM
  // session so no claude.exe children are orphaned
  const { tsxJobEngine } = await import('./tsx-jobs/tsx-job-engine');
  await tsxJobEngine.shutdown();

  // Kill any ffmpeg children generating Studio proxies/waveforms
  const { studioMediaJobs } = await import('./studio/media-jobs');
  studioMediaJobs.shutdown();
  const { llmEngine } = await import('../../engine');
  llmEngine.abortAll();

  // Flush AI usage log
  const { aiUsageService } = await import('./ai-usage');
  await aiUsageService.shutdown();

  // Pause all active downloads and persist state
  pauseAllDownloads();
  await flushState();

  // Clean up any running sd-cli processes
  const { imageLocalEngine } = await import('../../local-image-engine');
  imageLocalEngine.dispose();
  const { videoLocalEngine } = await import('../../local-video-engine/video-engine');
  videoLocalEngine.dispose();

  // Clean up audio engine (unload STT/TTS models)
  const { audioEngine } = await import('../../audio-engine');
  audioEngine.dispose();

  // Clean up local LLM engine (free GPU memory)
  const { llmLocalEngine } = await import('../../llm-engine');
  await llmLocalEngine.dispose();

  // Close SQLite DBs cleanly so WAL/SHM sidecars merge back.
  closeImageStudioDb();
  closeVideoStudioDb();
  closeTranscriptionDb();
  closeRenderQueueDb();
  closeSettingsDb();
  closeAiUsageDb();
  closeFlowsProjectsDb();
  closeDownloadsDb();

  await logEngine.shutdown();
}

/**
 * Runs teardown exactly once; repeat calls await the same promise.
 * Never rejects — a failed teardown must not block quitting or installing.
 */
export function gracefulShutdown(): Promise<void> {
  if (!shutdownPromise) {
    shutdownPromise = (async () => {
      try {
        await Promise.race([
          runShutdown(),
          new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
        ]);
      } catch (error) {
        // Nothing left to log to if the log engine itself failed — swallow and quit.
        try {
          logEngine.error('Shutdown', 'Graceful shutdown failed', error);
        } catch {
          // ignore
        }
      }
    })();
  }
  return shutdownPromise;
}
