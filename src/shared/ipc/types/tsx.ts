import type { TranscriptSegment } from './whisper';
import type { LlmImageIpc } from './llm';
import type { LayerTransform } from './studio';

// ─── TSX Auto-Edit Analysis ───
export type TsxSuggestionCategory =
  | 'text-overlay'
  | 'lower-third'
  | 'highlight'
  | 'callout'
  | 'data-visual'
  | 'custom';

export interface TsxSuggestion {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  description: string;
  prompt: string;
  category: TsxSuggestionCategory;
}

export interface TsxAnalyzeRequest {
  segments: TranscriptSegment[];
  videoDurationSeconds: number;
  videoWidth: number;
  videoHeight: number;
  fps: number;
  userPrompt?: string;
  // Resolved on the renderer from the project's brandId. Markdown is
  // inlined into the system prompt to steer style + voice.
  brand?: string;
  // Resolved on the renderer from the project's presetIds. Each preset
  // is appended as a composable editing guideline.
  presets?: { name: string; content: string }[];
}

export interface TsxAnalyzeResponse {
  success: boolean;
  suggestions?: TsxSuggestion[];
  error?: string;
}

// ─── TSX Slots (generated overlays) ───
//
// Slots start in "pending" state (placeholder on the timeline, no file yet)
// and graduate to "ready" once Generate has produced TSX code. The editor
// fields (`description`, `originalPrompt`, `customPrompt`, `referenceImages`)
// are populated when the slot is seeded from a TsxSuggestion so the slot is
// self-contained and survives the user clearing suggestions.
export interface TsxSlot {
  id: string;
  suggestionId: string;
  title: string;
  category: TsxSuggestionCategory;
  startTime: number;
  endTime: number;
  // Empty string while pending — set once Generate has written the file.
  fileName: string;
  code: string;
  sourceDurationSeconds?: number;
  inPointSeconds?: number;
  // ── Slot-editor state (pending + post-generate edit) ──
  // Human-readable description carried over from the seeding suggestion.
  description?: string;
  // The original AI-generated prompt. Kept verbatim so the user can "reset".
  originalPrompt?: string;
  // The user-edited prompt (overrides originalPrompt at generate time).
  customPrompt?: string;
  // Reference images for vision-aware generation. Base64 payloads — sent
  // straight to the LLM engine as multimodal blocks.
  referenceImages?: LlmImageIpc[];
  // Canvas position/size/rotation for this overlay. Undefined = full-frame.
  transform?: LayerTransform;
}
