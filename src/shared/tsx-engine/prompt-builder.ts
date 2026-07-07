import type { TsxPromptContext, PipelineMode } from './types';
import { buildGenerate2dPrompt } from './prompts/generate-2d-prompt';
import { buildGenerate3dPrompt } from './prompts/generate-3d-prompt';
import { VERIFY_2D_SYSTEM_PROMPT } from './prompts/verify-2d-prompt';
import { VERIFY_3D_SYSTEM_PROMPT } from './prompts/verify-3d-prompt';

export function buildTsxSystemPrompt(context: TsxPromptContext | undefined, mode: PipelineMode): string {
  return mode === '3d' ? buildGenerate3dPrompt(context) : buildGenerate2dPrompt(context);
}

export function buildVerifyPrompt(mode: PipelineMode): string {
  return mode === '3d' ? VERIFY_3D_SYSTEM_PROMPT : VERIFY_2D_SYSTEM_PROMPT;
}
