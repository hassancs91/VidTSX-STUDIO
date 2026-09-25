// The analysis branch of the media-job engine (docs/studio/
// FILTER_PACKS_DESIGN.md "Analysis tracks"), split out of media-jobs.ts:
// the two analysis kinds — `faceTrack` and `subjectMask` — their cache
// paths, their span-aware "already there" check and their run. They share
// ONE slot in the engine (one worker process, one frame at a time) and the
// worker's release when the last of them is done.

import type { StudioMediaJobKind } from '../../../shared/ipc/types/studio';
import type { StudioAnalysisMeta } from '../../../shared/ipc/types/studio-analysis';
import { faceTrackRelPath } from '../../../shared/studio/face-track';
import { maskIndexRelPath } from '../../../shared/studio/mask-track';
import { faceTrackSatisfying, generateFaceTrack, type FaceTrackJobOptions } from './face-track-job';
import { generateMaskTrack, maskTrackSatisfying } from './mask-track-job';

export type AnalysisJobKind = 'faceTrack' | 'subjectMask';

/** What to analyse: the asset kind, the frame source, the spans, the fps (both kinds take the same). */
export type AnalysisJobOptions = FaceTrackJobOptions;

export interface AnalysisJobResult {
  relPath: string;
  analysis: StudioAnalysisMeta;
}

export function isAnalysisKind(kind: StudioMediaJobKind): kind is AnalysisJobKind {
  return kind === 'faceTrack' || kind === 'subjectMask';
}

/** The file a ready event points at: the faces JSON, or the mask INDEX (the blobs sit beside it). */
export function analysisRelPath(kind: AnalysisJobKind, assetId: string): string {
  return kind === 'faceTrack' ? faceTrackRelPath(assetId) : maskIndexRelPath(assetId);
}

/** The cached track when it already covers the spans asked for (no job needed), else null. */
export async function analysisSatisfying(
  projectId: string,
  assetId: string,
  kind: AnalysisJobKind,
  options: AnalysisJobOptions,
): Promise<AnalysisJobResult | null> {
  return kind === 'faceTrack'
    ? faceTrackSatisfying(projectId, assetId, options)
    : maskTrackSatisfying(projectId, assetId, options);
}

/** Run one analysis job; progress arrives de-duplicated (whole percent + message). */
export async function runAnalysisJob(
  job: { projectId: string; assetId: string; kind: AnalysisJobKind; sourcePath: string; options: AnalysisJobOptions },
  signal: AbortSignal,
  onProgress: (percent: number, message?: string) => void,
): Promise<AnalysisJobResult> {
  let last = '';
  const progress = (percent: number, message?: string) => {
    const rounded = Math.round(percent);
    const key = `${rounded}:${message ?? ''}`;
    if (key === last || signal.aborted) return;
    last = key;
    onProgress(rounded, message);
  };
  const generate = job.kind === 'faceTrack' ? generateFaceTrack : generateMaskTrack;
  return generate(job.projectId, job.assetId, job.sourcePath, job.options, signal, progress);
}
