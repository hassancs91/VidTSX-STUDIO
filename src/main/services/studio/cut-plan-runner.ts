// I/O side of auto-cut planning: load the cached transcript + RMS envelope,
// run the pure cut-planner, write the plan JSON where the user can inspect it.
// Nothing here touches the timeline — plans become proposals in S3 step 3+.

import fs from 'fs/promises';
import path from 'path';
import type { StudioCutPlan, ResolvedCutStyle } from '../../../shared/types/studio-cut-plan';
import type { WaveformFile } from '../../../shared/types/studio-waveform';
import { WAVEFORM_VERSION } from '../../../shared/types/studio-waveform';
import { getProjectCacheDir } from './studio-paths';
import { readTranscriptFile } from './asset-transcriber';
import { generateWaveform, waveformRelPath } from './waveform-generator';
import { RmsEnvelope, planCuts } from '../../../shared/studio/cut-planner';
import { qaForPlan } from '../../../shared/studio/cut-qa';
import { cutsBetweenKeeps, keepsTag, normalizeKeeps, type CutKeep } from '../../../shared/studio/cut-keeps';

export const CUT_PLAN_DIR = 'cut-plans';

export interface RunCutPlanResult {
  plan: StudioCutPlan;
  /** Absolute path of the written plan JSON. */
  planPath: string;
}

/**
 * The RMS envelope comes from the waveform cache. Files before version 3
 * predate the zcr buckets (and v1 the rmsDb ones), so those regenerate once
 * (the peaks side is unchanged in shape).
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
  if (!file?.rmsDb || file.rmsDb.length === 0 || (file.version ?? 1) < WAVEFORM_VERSION) {
    await generateWaveform(projectId, assetId, sourcePath);
    file = await read();
  }
  if (!file?.rmsDb || file.rmsDb.length === 0 || !file.peaksPerSecond) {
    throw new Error('Could not compute the audio envelope for this asset');
  }
  return new RmsEnvelope(file.rmsDb, file.peaksPerSecond, file.zcr);
}

/**
 * Run the mechanical auto-cut pass for one transcribed asset with the resolved
 * cut style (cut-style-store `resolveProjectCutStyle`). The plan file is keyed
 * by style name AND knob key, so an edited preset never reuses a stale plan;
 * pre-B2 `<asset>-<style>.json` files are left alone (nothing reads them back).
 */
export async function runCutPlan(
  projectId: string,
  assetId: string,
  sourcePath: string,
  cut: ResolvedCutStyle,
  /**
   * B7: the asset's source ranges still on the timeline (cut-keeps
   * `timelineKeepsForAsset`). The plan runs over them only: the spans between
   * them are passed as cuts (no lead-in or tail reaches into what is already
   * cut) and are not proposed again. Absent / covering the whole source =
   * the whole-source plan of before.
   */
  timelineKeeps?: readonly CutKeep[],
): Promise<RunCutPlanResult> {
  const transcript = await readTranscriptFile(projectId, assetId);
  if (!transcript) {
    throw new Error('No transcript for this asset yet — transcribe it first');
  }
  if (!transcript.words || transcript.words.length === 0) {
    throw new Error('The transcript has no words to plan cuts from');
  }

  const envelope = await loadRmsEnvelope(projectId, assetId, sourcePath);

  const duration = envelope.duration();
  const keeps = normalizeKeeps(timelineKeeps, duration);
  const planned = planCuts({
    assetId,
    createdAt: new Date().toISOString(),
    styleName: cut.styleName,
    style: cut.style,
    styleDisplayName: cut.displayName,
    styleKey: cut.key,
    // The envelope is the measured audio length and is authoritative. The
    // transcript's duration is wrong in both directions: it stops at the last
    // spoken segment (understating trailing silence) and whisper pads its
    // final decode window past the real end (measured 41.7 s on a 39.4 s
    // file — "the transcript lies about time").
    duration,
    words: transcript.words,
    envelope,
    sttModelId: transcript.sttModelId,
    features: transcript.features,
    ...(keeps ? { keeps, cuts: cutsBetweenKeeps(keeps, duration) } : {}),
  });
  // B3: analyze_cut's two checks on the plan just made — over the keeps
  // planCuts used (B7: the timeline's; else one over the whole source) and
  // the knobs it used.
  const plan: StudioCutPlan = {
    ...planned,
    ...(keeps ? { keeps } : {}),
    qa: qaForPlan({
      segments: planned.segments,
      keeps: keeps ?? [{ start: 0, end: duration }],
      words: transcript.words,
      style: planned.style,
      envelope,
    }),
  };

  const cacheDir = await getProjectCacheDir(projectId);
  // B7: a keeps-limited plan gets its own file (tagged by its keeps), so it
  // never shares one with the whole-source plan of the same style.
  const name = `${assetId}-${cut.styleName}-${cut.key}${keeps ? `-${keepsTag(keeps)}` : ''}.json`;
  const planPath = path.join(cacheDir, CUT_PLAN_DIR, name);
  await fs.mkdir(path.dirname(planPath), { recursive: true });
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');

  return { plan, planPath };
}
