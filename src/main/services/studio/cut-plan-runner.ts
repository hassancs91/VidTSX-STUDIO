// I/O side of auto-cut planning: load the cached transcript + RMS envelope,
// run the pure cut-planner, write the plan JSON where the user can inspect it.
// Nothing here touches the timeline — plans become proposals in S3 step 3+.

import fs from 'fs/promises';
import path from 'path';
import type { StudioCutPlan, CutPlanStyleName } from '../../../shared/types/studio-cut-plan';
import type { WaveformFile } from '../../../shared/types/studio-waveform';
import { getProjectCacheDir } from './studio-paths';
import { readTranscriptFile } from './asset-transcriber';
import { generateWaveform, waveformRelPath } from './waveform-generator';
import { RmsEnvelope, planCuts } from '../../../shared/studio/cut-planner';

export const CUT_PLAN_DIR = 'cut-plans';

export interface RunCutPlanResult {
  plan: StudioCutPlan;
  /** Absolute path of the written plan JSON. */
  planPath: string;
}

/**
 * The RMS envelope comes from the waveform cache. Version-1 files predate the
 * rmsDb buckets, so those regenerate once (the peaks side is identical).
 * Shared with the editorial pass (studio-agent), which snaps agent-authored
 * cut spans against the same envelope.
 */
export async function loadRmsEnvelope(
  projectId: string,
  assetId: string,
  sourcePath: string,
): Promise<RmsEnvelope> {
  const cacheDir = await getProjectCacheDir(projectId);
  const waveformPath = path.join(cacheDir, waveformRelPath(assetId));

  const read = async (): Promise<WaveformFile | null> => {
    try {
      return JSON.parse(await fs.readFile(waveformPath, 'utf-8')) as WaveformFile;
    } catch {
      return null;
    }
  };

  let file = await read();
  if (!file?.rmsDb || file.rmsDb.length === 0) {
    await generateWaveform(projectId, assetId, sourcePath);
    file = await read();
  }
  if (!file?.rmsDb || file.rmsDb.length === 0 || !file.peaksPerSecond) {
    throw new Error('Could not compute the audio envelope for this asset');
  }
  return new RmsEnvelope(file.rmsDb, file.peaksPerSecond);
}

/** Run the mechanical auto-cut pass for one transcribed asset. */
export async function runCutPlan(
  projectId: string,
  assetId: string,
  sourcePath: string,
  styleName: CutPlanStyleName,
): Promise<RunCutPlanResult> {
  const transcript = await readTranscriptFile(projectId, assetId);
  if (!transcript) {
    throw new Error('No transcript for this asset yet — transcribe it first');
  }
  if (!transcript.words || transcript.words.length === 0) {
    throw new Error('The transcript has no words to plan cuts from');
  }

  const envelope = await loadRmsEnvelope(projectId, assetId, sourcePath);

  const plan = planCuts({
    assetId,
    createdAt: new Date().toISOString(),
    styleName,
    // The envelope is the measured audio length and is authoritative. The
    // transcript's duration is wrong in both directions: it stops at the last
    // spoken segment (understating trailing silence) and whisper pads its
    // final decode window past the real end (measured 41.7 s on a 39.4 s
    // file — "the transcript lies about time").
    duration: envelope.duration(),
    words: transcript.words,
    envelope,
    sttModelId: transcript.sttModelId,
    features: transcript.features,
  });

  const cacheDir = await getProjectCacheDir(projectId);
  const planPath = path.join(cacheDir, CUT_PLAN_DIR, `${assetId}-${styleName}.json`);
  await fs.mkdir(path.dirname(planPath), { recursive: true });
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');

  return { plan, planPath };
}
