// Analysis tracks (docs/studio/FILTER_PACKS_DESIGN.md "Analysis tracks"):
// the renderer asks main to analyse an asset's spans for a tracked filter;
// progress and the result ride the media-job event stream (kinds
// `faceTrack` / `subjectMask`). The faces track is read back through the
// cache-read channel like a waveform; the mask index too, and the mask
// blobs by byte range (`studioAnalysisReadMask`) — a 10-minute track is
// ~50–95 MB, so the Player reads the frames it is about to paint, never the file.

import type { AnalysisProvider, TrackSpan } from '../../studio/analysis-track';
import type { StudioMediaJobEvent } from './studio';

export type StudioAnalysisKind = 'faceTrack' | 'subjectMask';

/** What a finished analysis job reports about the track on disk. */
export interface StudioAnalysisMeta {
  /** The provider the latest run's frames ran on — recorded on the job, never guessed. */
  ep: AnalysisProvider;
  /** Source-second spans the track now covers. */
  spans: TrackSpan[];
  frames: number;
  fps: number;
  /** Masks: the model's input size of the latest run (short side 512 on DirectML, 352 on the CPU). */
  input?: { width: number; height: number };
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

/** A byte range of an asset's mask blobs (`cache/analysis/<assetId>/mask-v1.bin`). */
export interface StudioAnalysisReadMaskRequest {
  projectId: string;
  assetId: string;
  offset: number;
  /** At most `STUDIO_MASK_READ_MAX` bytes. */
  length: number;
}

export interface StudioAnalysisReadMaskResponse {
  success: boolean;
  /** Exactly `length` bytes (structured-cloned, no base64). */
  data?: Uint8Array;
  error?: string;
}

/** The largest range one read may ask for (a window of frames is ~5 KB each). */
export const STUDIO_MASK_READ_MAX = 8 * 1024 * 1024;
