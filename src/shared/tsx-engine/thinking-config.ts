import type { ThinkingLevel, ThinkingConfig } from './types';

/**
 * Maps the UI's thinking-level dial to the engine's thinking + effort payload.
 *
 * `off` → no thinking. All other levels use adaptive thinking (Opus 4.7 / 4.6 / Sonnet 4.6)
 * and rely on the `effort` parameter to control depth. On older models, ClaudeProvider
 * drops these fields via claude-capabilities.ts so MiniMax / OpenRouter non-Claude
 * routes continue to work.
 *
 * See docs/llm-engine-effort-migration.md for the capability matrix.
 */
export const THINKING_CONFIGS: Record<ThinkingLevel, ThinkingConfig> = {
  off: {},
  low: { thinking: { type: 'adaptive' }, effort: 'low' },
  medium: { thinking: { type: 'adaptive' }, effort: 'medium' },
  high: { thinking: { type: 'adaptive' }, effort: 'high' },
  xhigh: { thinking: { type: 'adaptive' }, effort: 'xhigh' },
  max: { thinking: { type: 'adaptive' }, effort: 'max' },
};

/**
 * The user-facing thinking dial. Production surfaces (the Creator) show these
 * three provider-neutral options; the six raw ThinkingLevels stay as the
 * internal/engine vocabulary (and in the dev-flagged AI chat tester).
 */
export const THINKING_UI_OPTIONS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'medium', label: 'Normal' },
  { value: 'max', label: 'Deep' },
];
