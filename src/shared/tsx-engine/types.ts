import type { LlmImageIpc } from '../ipc/types';

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface ThinkingConfig {
  thinking?: { type: 'enabled' | 'adaptive' | 'disabled'; budgetTokens?: number; display?: 'summarized' | 'omitted' };
  effort?: EffortLevel;
}

export interface GenerateResult {
  text: string;
  model: string;
  durationMs: number;
  debugLog?: string[];
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface TsxPromptContext {
  videoWidth?: number;
  videoHeight?: number;
  fps?: number;
  durationSeconds?: number;
  category?: string;
  extraInstructions?: string;
  /**
   * Saved GLB meshes the 3D prompt may reference (asset library, absolute paths) —
   * plan §5 step 7 "Library meshes". Empty/undefined = no section in the prompt.
   */
  libraryMeshes?: Array<{ path: string; description?: string; generated?: boolean }>;
}

export interface TsxGenerateOptions {
  prompt: string;
  providerId?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  promptContext?: TsxPromptContext;
  mode?: PipelineMode;
  images?: LlmImageIpc[];
}

export interface TsxEditOptions {
  currentCode: string;
  editInstruction: string;
  providerId?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  images?: LlmImageIpc[];
}

export interface TsxEditPipelineOptions {
  currentCode: string;
  editInstruction: string;
  providerId?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  maxFixRetries?: number;
  onProgress?: (progress: PipelineProgress) => void;
  images?: LlmImageIpc[];
  /** Prior refinement turns for this project — gives edits conversational continuity. */
  chatHistory?: { role: 'user' | 'assistant'; content: string }[];
}

export type PipelineStep = 'plan' | 'generate' | 'verify' | 'transpile' | 'fix';

export type PipelineMode = '2d' | '3d';

export interface PipelineProgress {
  step: PipelineStep;
  stepLabel: string;
  percent: number;
}

export interface TsxPipelineOptions {
  prompt: string;
  providerId?: string;
  thinkingLevel?: ThinkingLevel;
  maxTurns?: number;
  optimize?: boolean;
  promptContext?: TsxPromptContext;
  maxFixRetries?: number;
  mode?: PipelineMode;
  onProgress?: (progress: PipelineProgress) => void;
  images?: LlmImageIpc[];
}

export interface PipelineStepLog {
  step: PipelineStep;
  label: string;
  output: string;
  durationMs: number;
}

export interface TsxPipelineResult {
  text: string;
  model: string;
  durationMs: number;
  debugLog?: string[];
  steps: PipelineStepLog[];
  plan?: string;
  mode: PipelineMode;
  /** Exact system prompt the generate/edit step ran with — recorded in the
   *  debug sidecar so output changes can be attributed to prompt changes. */
  systemPrompt?: string;
  libraries?: string[];
  verified: boolean;
  transpileValid: boolean;
  fixAttempts: number;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}
