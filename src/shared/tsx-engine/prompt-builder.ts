import type { TsxPromptContext, PipelineMode } from './types';
import { buildGenerate2dPrompt } from './prompts/generate-2d-prompt';
import { buildGenerate3dPrompt } from './prompts/generate-3d-prompt';
import { VERIFY_2D_SYSTEM_PROMPT } from './prompts/verify-2d-prompt';
import { VERIFY_3D_SYSTEM_PROMPT } from './prompts/verify-3d-prompt';

export function buildTsxSystemPrompt(context: TsxPromptContext | undefined, mode: PipelineMode): string {
  return mode === '3d' ? buildGenerate3dPrompt(context) : buildGenerate2dPrompt(context);
}

export function buildVerifyPrompt(mode: PipelineMode, context?: TsxPromptContext): string {
  const base = mode === '3d' ? VERIFY_3D_SYSTEM_PROMPT : VERIFY_2D_SYSTEM_PROMPT;
  if (!context?.extraInstructions) return base;
  // The verify step must review under the SAME contract the code was generated
  // under, or it "fixes" contract-compliant code back to the generic checklist
  // (seen live: it stripped '@vidtsx/kit' imports and rewrote the shot
  // contract's durationInFrames into durationInSeconds).
  return [
    base,
    '',
    '## Caller contract (OVERRIDES conflicting checklist items)',
    '',
    'The file was generated under the contract below. Enforce it AS WRITTEN: imports it allows are allowed (never remove, replace, or inline them), and its required compositionConfig shape wins over checklist items 1–3.',
    '',
    context.extraInstructions,
  ].join('\n');
}
