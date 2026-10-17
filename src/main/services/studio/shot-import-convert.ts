// "Convert for Studio" on the way IN (P3 part 8, D10): a source the bundler
// could not make a shot goes to the TSX builder as a Quick edit
// (shotGenerator.convert, op 'import', at Studio's shot default). The builder
// edits a version on disk, so the source lands first: a new source in a fresh
// folder as v1.tsx (+ the kept original.tsx); a folder the reconcile scan found
// in this project's shots/ (P8-8) is adopted where it is, so the conversion is
// its next version and never a `<id>-2` copy. Either way the shot is registered
// before the build starts (the pool shows it converting and its cancel reaches
// the build); a conversion that fails or is cancelled leaves an error shot with
// its source kept.

import path from 'path';
import type { StudioShot } from '../../../shared/types/studio';
import { isValidShotId } from '../../../shared/studio/shots';
import { logEngine } from '../../../logging/log-engine';
import { keepOriginal } from './shot-bundle-in-place';
import { ShotCancelledError, shotGenerator } from './shot-generator';
import { buildImportedShot, writeImportedShot } from './shot-import-land';
import { shotJobEvents } from './shot-job-events';

const log = logEngine.createLogger('ShotImportConvert');

export interface ConvertImportInput {
  projectId: string;
  /** This project's shots/ folder. */
  shotsDir: string;
  sourcePath: string;
  name: string;
  source: string;
  /** Why it is not a shot yet: the gate's error and the bundler's reason. */
  problems: string[];
  providerId?: string;
  model?: string;
  /** Fires once the shot is registered: the IPC handshake returns then. */
  onReserved?: (shotId: string) => void;
}

/** `shots/<id>/vN.tsx` of this project: a folder the reconcile scan could not adopt. Null for any other path. */
export function dropInVersion(shotsDir: string, sourcePath: string): { shotId: string; version: number } | null {
  const rel = path.relative(shotsDir, sourcePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const parts = rel.split(/[\\/]/);
  const file = parts.length === 2 ? /^v(\d+)\.tsx$/i.exec(parts[1]) : null;
  if (!file || !isValidShotId(parts[0])) return null;
  return { shotId: parts[0], version: Number(file[1]) };
}

export async function convertImport(input: ConvertImportInput): Promise<{ shotId: string; error?: string }> {
  const { projectId } = input;
  const dropIn = dropInVersion(input.shotsDir, input.sourcePath);
  let shotId: string;
  let version: number;
  if (dropIn) {
    ({ shotId, version } = dropIn);
    await keepOriginal(path.join(input.shotsDir, shotId), input.source);
  } else {
    ({ shotId } = await writeImportedShot(input.shotsDir, input.name, input.source, input.source));
    version = 1;
  }

  const entry: StudioShot = { ...buildImportedShot(shotId, input.name, input.source, version), status: 'generating' };
  shotJobEvents.emit({ projectId, shotId, op: 'import', status: 'generating', percent: 0, message: 'Converting…', shot: entry });
  input.onReserved?.(shotId);

  try {
    const { shot } = await shotGenerator.convert({
      projectId,
      shotId,
      activeVersion: version,
      kind: entry.kind,
      problems: input.problems,
      ...(input.providerId ? { providerId: input.providerId } : {}),
      ...(input.model ? { model: input.model } : {}),
    });
    log.info('Converted and imported shot', { projectId, shotId, dropIn: dropIn !== null, version: shot.activeVersion });
    return { shotId };
  } catch (err) {
    const message =
      err instanceof ShotCancelledError
        ? `Conversion cancelled: v${version} is the source as imported, which Studio cannot play. Edit it, or remove the shot.`
        : err instanceof Error
          ? err.message
          : 'Conversion failed';
    shotJobEvents.emit({ projectId, shotId, op: 'import', status: 'error', error: message, shot: { ...entry, status: 'error', error: message } });
    return { shotId, error: message };
  }
}
