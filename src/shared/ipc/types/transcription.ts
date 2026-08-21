import type { TranscriptResult } from './whisper';

/**
 * Which engine produced a transcript. Canonical values are the STT provider
 * types ('local-whisper' | 'assemblyai' | 'elevenlabs' | 'openrouter');
 * 'whisper' and 'vidtsx' are legacy values persisted by older versions (treat
 * 'whisper' as 'local-whisper'; 'vidtsx' projects load read-only onto the
 * default model).
 */
export type TranscribeEngine =
  | 'local-whisper'
  | 'assemblyai'
  | 'elevenlabs'
  | 'openrouter'
  | 'whisper'
  | 'vidtsx';

// ─── Transcription project types ───
export interface TranscriptionProjectData {
  id: string;
  name: string;
  sourceFilePath: string;
  sourceFileName: string;
  sourceFileType: 'video' | 'audio';
  /** Engine used. Optional for backward-compat with pre-existing projects (treat as 'whisper'). */
  engine?: TranscribeEngine;
  modelId: string;
  language: string;
  result: TranscriptResult;
  createdAt: number;
  updatedAt: number;
}

export interface TranscriptionProjectListEntry {
  id: string;
  name: string;
  sourceFileName: string;
  sourceFileType: 'video' | 'audio';
  language: string;
  duration: number;
  segmentCount: number;
  updatedAt: number;
}

export interface TranscriptionProjectListResponse {
  success: boolean;
  projects?: TranscriptionProjectListEntry[];
  error?: string;
}

export interface TranscriptionProjectSaveRequest {
  project: TranscriptionProjectData;
}

export interface TranscriptionProjectSaveResponse {
  success: boolean;
  error?: string;
}

export interface TranscriptionProjectLoadRequest {
  id: string;
}

export interface TranscriptionProjectLoadResponse {
  success: boolean;
  project?: TranscriptionProjectData;
  error?: string;
}

export interface TranscriptionProjectDeleteRequest {
  id: string;
}

export interface TranscriptionProjectDeleteResponse {
  success: boolean;
  error?: string;
}
