export type {
  ExtractedFrame,
  FrameExtractProgressEvent,
  FrameExtractionPreset,
} from '@shared/ipc/types';

export type FrameExtractorPhase =
  | 'idle'
  | 'configuring'
  | 'probing'
  | 'extracting'
  | 'reading'
  | 'complete'
  | 'error';

export interface VideoInfo {
  path: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}
