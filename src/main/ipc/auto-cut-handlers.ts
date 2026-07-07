// IPC handlers for the two halves of the auto-cut pipeline:
//   - STUDIO_ANALYZE_RUN          → runMechanicalAnalysis (stages 1-4)
//   - STUDIO_AUTO_CUT_RUN         → planCuts (stage 5, Claude)
//
// Analysis is the shared spine: persisted to the DB and to disk
// (<workspace>/analysis.json) so downstream skills (auto-cut planner,
// plan-tsx, plan-sfx, plan-transitions) all consume the same cached signal.
// Auto-cut consumes the analysis; it does NOT re-run STT.

import { writeFile } from 'fs/promises';
import path from 'path';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { IPC } from '@shared/ipc/channels';
import type {
  StudioAnalyzeRunRequest,
  StudioAnalyzeRunResponse,
  StudioAnalyzeCancelRequest,
  StudioAnalyzeCancelResponse,
  StudioAnalyzeProgress,
  StudioAutoCutRunRequest,
  StudioAutoCutRunResponse,
  StudioAutoCutCancelRequest,
  StudioAutoCutCancelResponse,
  StudioAutoCutProgress,
} from '../../shared/ipc/types';
import { loadProject, saveProject } from '../services/studio-projects-db';
import { runMechanicalAnalysis } from '../services/auto-cut/analyze';
import { getAutoCutDir } from '../services/auto-cut/extract-audio';
import { planCuts } from '../services/auto-cut/plan-cuts';

const log = logEngine.createLogger('AutoCutHandlers');

// One run of each kind per project at a time. Separate controllers so the user
// could (in principle) cancel an analysis without affecting an in-flight plan.
const analyzeInFlight = new Map<string, AbortController>();
const autoCutInFlight = new Map<string, AbortController>();

function emit<T>(wc: WebContents, channel: string, payload: T): void {
  try {
    wc.send(channel, payload);
  } catch (err) {
    log.warn('Failed to emit progress', { err: String(err) });
  }
}

// ─── Analyze ────────────────────────────────────────────────────────────────

export async function handleStudioAnalyzeRun(
  event: IpcMainInvokeEvent,
  req: StudioAnalyzeRunRequest,
): Promise<StudioAnalyzeRunResponse> {
  if (analyzeInFlight.has(req.projectId)) {
    return { success: false, error: 'Analyze already running for this project' };
  }
  const controller = new AbortController();
  analyzeInFlight.set(req.projectId, controller);

  try {
    const project = await loadProject(req.projectId);
    if (!project) return { success: false, error: 'Project not found' };

    const clip = (project.videoClips ?? []).find((c) => c.id === req.clipId);
    if (!clip) return { success: false, error: 'Clip not found in project' };

    const sourceDuration = clip.endTime - clip.startTime;

    const { analysis, workspaceDir } = await runMechanicalAnalysis({
      projectId: req.projectId,
      clipId: req.clipId,
      videoPath: clip.filePath,
      durationSeconds: sourceDuration,
      sttModelId: req.sttModelId,
      signal: controller.signal,
      onProgress: (stage, percent, message) => {
        emit<StudioAnalyzeProgress>(event.sender, IPC.STUDIO_ANALYZE_PROGRESS, {
          projectId: req.projectId,
          clipId: req.clipId,
          stage,
          percent,
          message,
        });
      },
    });

    // Persist analysis. Re-analyzing invalidates any prior cut plan and
    // hidden-clip state because both were derived from the previous analysis.
    const restoredClips = (project.videoClips ?? []).map((c) =>
      c.hidden ? { ...c, hidden: false, cutReason: undefined } : c
    );
    const updated = {
      ...project,
      analysis,
      cutPlan: undefined,
      videoClips: restoredClips,
      updatedAt: Date.now(),
    };
    await saveProject(updated);

    emit<StudioAnalyzeProgress>(event.sender, IPC.STUDIO_ANALYZE_PROGRESS, {
      projectId: req.projectId,
      clipId: req.clipId,
      stage: 'prosody',
      percent: 100,
      message: 'Done',
    });

    return { success: true, analysis, workspaceDir };
  } catch (err) {
    if (controller.signal.aborted) return { success: false, cancelled: true };
    const message = err instanceof Error ? err.message : 'Analyze failed';
    log.error('analyze run failed', err instanceof Error ? err : new Error(message));
    return { success: false, error: message };
  } finally {
    analyzeInFlight.delete(req.projectId);
  }
}

export async function handleStudioAnalyzeCancel(
  _event: IpcMainInvokeEvent,
  req: StudioAnalyzeCancelRequest,
): Promise<StudioAnalyzeCancelResponse> {
  const controller = analyzeInFlight.get(req.projectId);
  if (controller) controller.abort();
  return { success: true };
}

// ─── Auto-cut planner ───────────────────────────────────────────────────────

export async function handleStudioAutoCutRun(
  event: IpcMainInvokeEvent,
  req: StudioAutoCutRunRequest,
): Promise<StudioAutoCutRunResponse> {
  if (autoCutInFlight.has(req.projectId)) {
    return { success: false, error: 'Auto-cut already running for this project' };
  }
  const controller = new AbortController();
  autoCutInFlight.set(req.projectId, controller);

  try {
    const project = await loadProject(req.projectId);
    if (!project) return { success: false, error: 'Project not found' };
    if (!project.analysis) {
      return {
        success: false,
        error: 'Run Analyze first — auto-cut needs the transcript and prosody signal.',
      };
    }

    // Make sure analysis.json on disk matches the project's persisted analysis
    // (handles edge cases: workspace deleted, project moved, etc.). Cheap.
    const workspaceDir = getAutoCutDir(req.projectId);
    const analysisPath = path.join(workspaceDir, 'analysis.json');
    await writeFile(analysisPath, JSON.stringify(project.analysis, null, 2), 'utf-8');

    const brand = req.brand ?? project.brand;

    emit<StudioAutoCutProgress>(event.sender, IPC.STUDIO_AUTO_CUT_PROGRESS, {
      projectId: req.projectId,
      stage: 'plan',
      percent: 5,
      message: 'Loading skill…',
    });

    const cutPlan = await planCuts({
      workspaceDir,
      analysisPath,
      sourceDuration: project.analysis.source.duration,
      brand,
      signal: controller.signal,
      onThinking: (msg) => {
        emit<StudioAutoCutProgress>(event.sender, IPC.STUDIO_AUTO_CUT_PROGRESS, {
          projectId: req.projectId,
          stage: 'plan',
          percent: 50,
          message: msg,
        });
      },
    });

    const updated = {
      ...project,
      cutPlan,
      updatedAt: Date.now(),
    };
    await saveProject(updated);

    emit<StudioAutoCutProgress>(event.sender, IPC.STUDIO_AUTO_CUT_PROGRESS, {
      projectId: req.projectId,
      stage: 'plan',
      percent: 100,
      message: `Plan ready — ${cutPlan.cuts.length} cuts`,
    });

    return { success: true, cutPlan, workspaceDir };
  } catch (err) {
    if (controller.signal.aborted) return { success: false, cancelled: true };
    const message = err instanceof Error ? err.message : 'Auto-cut failed';
    log.error('auto-cut run failed', err instanceof Error ? err : new Error(message));
    return { success: false, error: message };
  } finally {
    autoCutInFlight.delete(req.projectId);
  }
}

export async function handleStudioAutoCutCancel(
  _event: IpcMainInvokeEvent,
  req: StudioAutoCutCancelRequest,
): Promise<StudioAutoCutCancelResponse> {
  const controller = autoCutInFlight.get(req.projectId);
  if (controller) controller.abort();
  return { success: true };
}
