// ─── Tools: Frame Extractor types ───
export type FrameExtractionPreset = 'custom' | 'first-frame' | 'last-frame' | 'every-x-seconds';

export interface FrameExtractRequest {
  videoPath: string;
  fps: number;
  preset: FrameExtractionPreset;
  everyXSeconds?: number;
  outputFormat: 'png' | 'jpg';
}

export interface ExtractedFrame {
  index: number;
  timestamp: number;
  fileName: string;
  filePath: string;
}

export interface FrameExtractResponse {
  success: boolean;
  frames?: ExtractedFrame[];
  outputDir?: string;
  error?: string;
}

export interface FrameExtractProgressEvent {
  phase: 'probing' | 'extracting' | 'reading';
  percent: number;
  framesExtracted: number;
  totalFrames: number;
  message?: string;
}

export interface FrameExtractCancelResponse {
  success: boolean;
}

export interface FrameSaveZipRequest {
  framePaths: string[];
  defaultName?: string;
}

export interface FrameSaveZipResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface FrameSaveSingleRequest {
  framePath: string;
  defaultName?: string;
}

export interface FrameSaveSingleResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}
