import type { LlmImageIpc } from './llm';
import type { ThinkingLevel, PipelineMode, TsxPromptContext } from '../../tsx-engine/types';

export type TsxJobKind = 'generate' | 'edit' | 'fix';

export type TsxJobStatus =
  | 'queued'
  | 'planning'
  | 'generating'
  | 'verifying'
  | 'fixing'
  | 'naming'
  | 'saving'
  | 'done'
  | 'error'
  | 'cancelled';

export interface TsxJobProgressIpc {
  step: string;
  label: string;
  percent: number;
}

export interface TsxJobUsageIpc {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/** Snapshot of a job, pushed to the renderer over TSXJOB_EVENT. */
export interface TsxJobIpc {
  id: string;
  kind: TsxJobKind;
  /** User prompt (generate) or edit/fix instruction. */
  prompt: string;
  providerId?: string;
  status: TsxJobStatus;
  progress: TsxJobProgressIpc;
  /** For edit/fix jobs: the project folder being modified. */
  targetFolderPath?: string;
  /** Set on completion. */
  projectName?: string;
  folderPath?: string;
  versionPath?: string;
  mode?: PipelineMode;
  error?: string;
  usage?: TsxJobUsageIpc;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TsxJobOptionsIpc {
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  optimize?: boolean;
  promptContext?: TsxPromptContext;
  maxFixRetries?: number;
  mode?: PipelineMode;
  images?: LlmImageIpc[];
}

export interface TsxJobStartRequest {
  kind: TsxJobKind;
  /** User prompt (generate) or edit/fix instruction. */
  prompt: string;
  providerId?: string;
  options?: TsxJobOptionsIpc;
  /** Required for edit/fix jobs. */
  target?: {
    folderPath: string;
    currentCode: string;
  };
}

export interface TsxJobStartResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

export interface TsxJobCancelRequest {
  jobId: string;
}

export interface TsxJobCancelResponse {
  success: boolean;
  error?: string;
}

export interface TsxJobListResponse {
  jobs: TsxJobIpc[];
}

export interface TsxJobClearCompletedResponse {
  success: boolean;
  removed: number;
}

/** Push event payload: one job snapshot per change. */
export interface TsxJobEvent {
  job: TsxJobIpc;
}

/** Live LLM output chunk for a job in its generating step (throttled). */
export interface TsxJobStreamEvent {
  jobId: string;
  chunk: string;
}
