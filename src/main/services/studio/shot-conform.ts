// "Convert for Studio" for a shot that is ALREADY in a project — the second
// half of the D14 import story, and what makes the import flow's convert
// card (Q7d) a real button.
//
// shot-import.ts converts a source file on the way IN, into a folder it
// reserves. A package import is the other case: the shot folder, its id and
// the clips that reference that id all arrived together, so a conversion must
// land as a NEW VERSION IN THE SAME FOLDER. Renaming or re-importing would
// orphan every clip pointing at the old id.
//
// P3 part 8 (D10): the bundler first (shot-bundle-in-place.ts, no model); what
// it cannot fix goes to the TSX builder as a Quick edit of the active version
// (shotGenerator.convert, at Studio's shot default), whose check IS the
// acceptance gate, so a conversion that still fails never lands as a version.
// The untouched source is kept as original.tsx.

import fs from 'fs/promises';
import path from 'path';
import type { StudioShot } from '../../../shared/types/studio';
import { classifyShotImport, describeImportFailure } from '../../../shared/studio/shot-import';
import { logEngine } from '../../../logging/log-engine';
import { parseCompositionConfig } from '../composition-config-parser';
import { ShotCancelledError, shotDefaults, shotGenerator, validateShotCode } from './shot-generator';
import { bundleShotInPlace, keepOriginal } from './shot-bundle-in-place';
import { shotJobEvents } from './shot-job-events';
import { loadProject } from './project-store';
import { getProjectDir, getShotVersionPath } from './studio-paths';

const log = logEngine.createLogger('ShotConform');

export interface ConformShotRequest {
  projectId: string;
  shotId: string;
}

export interface ConformShotOutcome {
  shotId: string;
  /** The version the shot now points at (unchanged when it already passed). */
  version?: number;
  error?: string;
}

/** Registry entry for a version that passes as it is, or bundled — config re-parsed from its source. */
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
 * Make an in-project shot a Studio shot. Progress and the finished registry
 * entry ride the shared shot job-event stream (op 'import'), so the editor
 * adopts the new version exactly as it adopts a generated one; the outcome
 * resolves when it is done.
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

  // Never burn a model run on a file the gate already accepts.
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

  // The mechanical step first (P3 part 8, D10): the bundler inlines the library
  // set with no model, as vN+1 in this folder.
  const folderPath = path.join(await getProjectDir(projectId), 'shots', shotId);
  const bundled = await bundleShotInPlace({ projectId, folderPath, version: shot.activeVersion, source });
  if (bundled.ok) {
    const conformed = buildConformedShot(shot, bundled.code, bundled.version);
    if (Object.keys(bundled.assetRefs).length > 0) conformed.assetRefs = { ...shot.assetRefs, ...bundled.assetRefs };
    shotJobEvents.emit({
      projectId,
      shotId,
      op: 'import',
      status: 'ready',
      shot: conformed,
      ...(bundled.assets.length > 0 ? { importedAssets: bundled.assets } : {}),
    });
    log.info('Bundled shot in place', { projectId, shotId, version: bundled.version, ...bundled.report });
    return { shotId, version: bundled.version };
  }

  const gateError = gate.error ?? 'Failed the shot gate';
  const classification = classifyShotImport(source, { syntaxError: gate.syntaxError === true });
  if (!classification.canConform) {
    return { shotId, error: describeImportFailure(classification, gateError, bundled.reason) };
  }

  await keepOriginal(folderPath, source);
  try {
    const { shot: converted } = await shotGenerator.convert({
      projectId,
      shotId,
      activeVersion: shot.activeVersion,
      kind: shot.kind,
      ...(shot.anchor ? { anchor: shot.anchor } : {}),
      ...(shot.assetRefs ? { assetRefs: shot.assetRefs } : {}),
      problems: [gateError, `Bundling it into one Studio shot did not work: ${bundled.reason}`],
      ...shotDefaults(project.settings.agent),
    });
    log.info('Converted shot in place', { projectId, shotId, version: converted.activeVersion });
    return { shotId, version: converted.activeVersion };
  } catch (err) {
    if (err instanceof ShotCancelledError) return { shotId, error: 'Conversion cancelled: the shot is as it was.' };
    return { shotId, error: err instanceof Error ? err.message : 'Conversion failed' };
  }
}
