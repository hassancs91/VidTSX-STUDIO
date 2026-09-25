// Analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md "Analysis tracks"):
// the renderer asks main to analyse an asset's spans for a tracked filter;
// progress and the result ride the media-job event stream (kind
// `faceTrack`), and the track itself is read back through the cache-read
// channel like a waveform.

import type { AnalysisProvider, TrackSpan } from '../../studio/face-track';
import type { StudioMediaJobEvent } from './studio';

export type StudioAnalysisKind = 'faceTrack';

/** What a finished analysis job reports about the track on disk. */
export interface StudioAnalysisMeta {
  /** The provider the latest run's frames ran on — recorded on the job, never guessed. */
  ep: AnalysisProvider;
  /** Source-second spans the track now covers. */
  spans: TrackSpan[];
  frames: number;
  fps: number;
  /** Why DirectML was not used, when the CPU fallback ran. */
  fallback?: string;
}

export interface StudioAnalysisRequest {
  projectId: string;
  assetId: string;
  kind: StudioAnalysisKind;
  assetKind: 'video' | 'image';
  /** The original's absolute path. */
  sourcePath: string;
  /** The ready proxy's cache-relative path — the frame feed's input when present. */
  proxyRelPath?: string;
  /** Source-second spans the clips need (the job unions them with the cache). */
  spans: TrackSpan[];
  /** The project's fps: the track's sampling rate. */
  fps: number;
}

export interface StudioAnalysisResponse {
  success: boolean;
  /** Present when the cache already covered the request — no job was queued. */
  ready?: StudioMediaJobEvent;
  error?: string;
}

export interface StudioAnalysisCancelRequest {
  projectId: string;
  assetId: string;
  kind: StudioAnalysisKind;
}

export interface StudioAnalysisCancelResponse {
  success: boolean;
}
