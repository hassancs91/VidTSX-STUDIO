// Learn-from-video's cut half (plan T1 "the learning signal", B4): collect
// the joins the user touched on the master lane, load each asset's words and
// audio envelope (the same loaders the editorial snap uses), measure them
// against the project's RESOLVED cut style (B2's resolver — what the joins
// were snapped with) and turn the report into `cut.<knob>` changes and card
// lines. Nothing is written here; accept is the only write.

import path from 'path';
import type { StudioProject } from '../../../shared/types/studio';
import type { CutLearnReport } from '../../../shared/types/studio-cut-learn';
import type { StudioPresetKnobChange } from '../../../shared/types/studio-preset';
import { collectCutLearnJoins } from '../../../shared/studio/cut-learn-joins';
import { learnCutKnobs } from '../../../shared/studio/cut-learn';
import type { CutLearnAsset } from '../../../shared/studio/cut-learn-measure';
import { logEngine } from '../../../logging/log-engine';
import { readTranscriptFile } from './asset-transcriber';
import { loadRmsEnvelope } from './cut-plan-runner';
import { resolveProjectCutStyle } from './cut-style-store';
import { cutKnobChange, formatCutLearnLines } from './cut-learn-format';

const log = logEngine.createLogger('LearnCutKnobs');

export interface ProjectCutLearning {
  report: CutLearnReport;
  changes: StudioPresetKnobChange[];
  lines: string[];
}

async function loadAsset(project: StudioProject, assetId: string): Promise<CutLearnAsset | null> {
  const asset = project.assets.find((a) => a.id === assetId);
  if (!asset) return null;
  try {
    const file = await readTranscriptFile(project.id, assetId);
    if (!file?.words || file.words.length === 0) return null;
    const envelope = await loadRmsEnvelope(project.id, assetId, asset.path);
    return { words: file.words, envelope };
  } catch (err) {
    log.warn('Cut learning: asset unreadable', { assetId, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

/** The cut-knob learning for this document, or null when the user touched no join. */
export async function learnProjectCutKnobs(project: StudioProject): Promise<ProjectCutLearning | null> {
  const inputs = collectCutLearnJoins(project.timeline, project.proposals ?? []);
  if (inputs.length === 0) return null;

  const assets = new Map<string, CutLearnAsset>();
  const unreadable: string[] = [];
  for (const assetId of new Set(inputs.map((i) => i.assetId))) {
    const loaded = await loadAsset(project, assetId);
    if (loaded) assets.set(assetId, loaded);
    else {
      const asset = project.assets.find((a) => a.id === assetId);
      unreadable.push(asset ? path.basename(asset.path) : assetId);
    }
  }

  // The live document's settings: an unsaved project override still counts.
  const resolved = await resolveProjectCutStyle(project.id, { settings: project.settings });
  const report = learnCutKnobs(inputs, assets, resolved.style);
  const changes = report.changes.map((c) => cutKnobChange(c, report));
  const lines = formatCutLearnLines(report, { projectOverride: resolved.source === 'project', unreadable });
  log.info('Cut knobs measured', {
    projectId: project.id,
    style: resolved.displayName,
    joins: report.joins,
    headEdges: report.headEdges,
    tailEdges: report.tailEdges,
    changes: changes.map((c) => `${c.key} ${String(c.from)}→${String(c.to)}`),
  });
  return { report, changes, lines };
}
