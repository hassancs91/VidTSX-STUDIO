// "Convert for Studio" for a shot that is ALREADY in a project — the second
// half of the D14 allowlist story, and what makes the import flow's convert
// card (Q7d) a real button.
//
// shot-import.ts conforms a source file on the way IN, before a shot exists, so
// it is free to reserve a fresh folder. A package import is the other case:
// the shot folder, its id and the clips that reference that id all arrived
// together, so a conversion must land as a NEW VERSION IN THE SAME FOLDER.
// Renaming or re-importing would orphan every clip pointing at the old id.
//
// Same one-pass shape as the import conform: one editTsxPipeline run whose
// validate dep IS the acceptance gate, so a conversion that still fails never
// reaches disk as a version, and the untouched source is kept as original.tsx.

import fs from 'fs/promises';
import path from 'path';
import { editTsxPipeline } from '../../../shared/tsx-engine';
import type { StudioShot } from '../../../shared/types/studio';
import { buildConformInstruction, classifyShotImport } from '../../../shared/studio/shot-import';
import { logEngine } from '../../../logging/log-engine';
import { writeNextVersion } from '../tsx-jobs/project-store';
import { parseCompositionConfig } from '../composition-config-parser';
import { buildShotEngineDeps, validateShotCode } from './shot-generator';
import { ORIGINAL_FILE_NAME } from './shot-import';
import { shotJobEvents } from './shot-job-events';
import { loadProject } from './project-store';
import { getProjectDir, getShotVersionPath } from './studio-paths';

const log = logEngine.createLogger('ShotConform');

export interface ConformShotRequest {
  projectId: string;
  shotId: string;
  providerId?: string;
  model?: string;
}

export interface ConformShotOutcome {
  shotId: string;
  /** The version the shot now points at (unchanged when it already passed). */
  version?: number;
  error?: string;
}

/** Registry entry for the converted version — config re-parsed from the new
 *  source, because a conform pass may legitimately change nothing else. */
function buildConformedShot(shot: StudioShot, code: string, version: number): StudioShot {
  const config = parseCompositionConfig(code);
  const next: StudioShot = {
    ...shot,
    activeVersion: version,
    status: 'ready',
    ...(config
      ? {
          config: {
            durationInFrames: config.durationInFrames,
            fps: config.fps,
            width: config.width,
            height: config.height,
          },
        }
      : {}),
  };
  delete next.error;
  return next;
}

/**
 * Convert an in-project shot to the shot import surface (react + remotion).
 * Progress and the finished registry entry ride the shared shot job-event
 * stream, so the editor adopts the new version exactly as it adopts a
 * generated one.
 */
export async function conformShot(request: ConformShotRequest): Promise<ConformShotOutcome> {
  const { projectId, shotId } = request;
  const project = await loadProject(projectId);
  const shot = project.shots.find((entry) => entry.id === shotId);
  if (!shot) return { shotId, error: 'That shot is not in this project.' };

  const versionPath = await getShotVersionPath(projectId, shotId, shot.activeVersion);
  let source: string;
  try {
    source = await fs.readFile(versionPath, 'utf-8');
  } catch {
    return { shotId, error: 'The shot has no source file to convert.' };
  }

  // Never burn an LLM run on a file the gate already accepts.
  const gate = await validateShotCode(source);
  if (gate.success) {
    shotJobEvents.emit({
      projectId,
      shotId,
      op: 'import',
      status: 'ready',
      shot: buildConformedShot(shot, source, shot.activeVersion),
    });
    return { shotId, version: shot.activeVersion };
  }

  const classification = classifyShotImport(source);
  if (!classification.canConform) {
    return {
      shotId,
      error:
        'This shot needs a manual edit, not a conversion — it imports local files or packages a conform pass cannot inline.',
    };
  }

  const folderPath = path.join(await getProjectDir(projectId), 'shots', shotId);
  const originalPath = path.join(folderPath, ORIGINAL_FILE_NAME);
  try {
    await fs.access(originalPath);
  } catch {
    await fs.writeFile(originalPath, source, 'utf-8');
  }

  const progress = (percent: number, message: string): void =>
    shotJobEvents.emit({
      projectId,
      shotId,
      op: 'import',
      status: 'generating',
      percent,
      message: `Converting — ${message}`,
      shot: { ...shot, status: 'generating' },
    });
  progress(0, 'starting');

  try {
    const result = await editTsxPipeline(
      {
        currentCode: source,
        editInstruction: buildConformInstruction(classification.conformable),
        ...(request.providerId ? { providerId: request.providerId } : {}),
        ...(request.model ? { model: request.model } : {}),
        onProgress: (p) => progress(p.percent, p.stepLabel),
      },
      buildShotEngineDeps(request.providerId, undefined, request.model),
    );
    if (!result.transpileValid) {
      throw new Error(
        'The converted composition still fails the shot gate (react + remotion only, default export, compositionConfig) — the original is kept as original.tsx.',
      );
    }

    const writtenPath = await writeNextVersion(folderPath, result.text);
    const version = Number(/v(\d+)\.tsx$/.exec(path.basename(writtenPath))?.[1]);
    const conformed = buildConformedShot(shot, result.text, version);
    shotJobEvents.emit({ projectId, shotId, op: 'import', status: 'ready', shot: conformed });
    log.info('Conformed shot in place', { projectId, shotId, version });
    return { shotId, version };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversion failed';
    shotJobEvents.emit({
      projectId,
      shotId,
      op: 'import',
      status: 'error',
      error: message,
      shot: { ...shot, status: 'error', error: message },
    });
    log.error('Shot conversion failed', err, { projectId, shotId });
    return { shotId, error: message };
  }
}
