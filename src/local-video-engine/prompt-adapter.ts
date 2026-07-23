/**
 * Per-family prompt adaptation for sd-cli video generation.
 *
 * LingBot-Video was trained on structured JSON captions (see sd.cpp
 * docs/lingbot_video.md): the prompt must be a JSON object with a
 * `caption.comprehensive_description`, and the negative prompt a
 * `universal_negative` object. Plain text prompts are wrapped into that
 * structure here; prompts that are already JSON pass through untouched.
 *
 * Wan quality depends heavily on the canonical negative prompt from the Wan
 * papers/docs (in Chinese) — it is applied whenever the user leaves the
 * negative empty. LTX gets the doc-recommended default negative.
 */
import type { VideoModelFamily } from './types';

export interface AdaptedPrompt {
  prompt: string;
  negativePrompt?: string;
}

/** Canonical Wan negative prompt (from the sd.cpp Wan examples / Wan docs). */
export const WAN_DEFAULT_NEGATIVE =
  '色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，最差质量，低质量，JPEG压缩残留，' +
  '丑陋的，残缺的，多余的手指，画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，' +
  '杂乱的背景，三条腿，背景人很多，倒着走';

export const LTX_DEFAULT_NEGATIVE =
  'worst quality, low quality, blurry, distorted, artifacts';

const LINGBOT_DEFAULT_NEGATIVE_TERMS = [
  'low quality', 'worst quality', 'blurry', 'pixelated', 'jpeg artifacts',
  'low resolution', 'flickering', 'jittery', 'temporal inconsistency',
  'warping', 'morphing', 'unnatural movement', 'watermark', 'text', 'logo',
];

function looksLikeJson(text: string): boolean {
  return text.trim().startsWith('{');
}

function lingbotPrompt(plainPrompt: string): string {
  return JSON.stringify({
    caption: {
      comprehensive_description: plainPrompt,
      camera_info: {},
      world_knowledge: [],
      prominent_elements: [],
    },
  });
}

function lingbotNegative(plainNegative: string | undefined): string {
  const terms = plainNegative
    ? plainNegative.split(',').map((t) => t.trim()).filter(Boolean)
    : LINGBOT_DEFAULT_NEGATIVE_TERMS;
  return JSON.stringify({ universal_negative: { visual_quality: terms } });
}

/**
 * Adapt a plain-text prompt/negative pair to what the family expects.
 * Already-JSON LingBot prompts pass through untouched (power users).
 */
export function adaptPrompt(
  family: VideoModelFamily,
  prompt: string,
  negativePrompt?: string,
): AdaptedPrompt {
  switch (family) {
    case 'lingbot':
      return {
        prompt: looksLikeJson(prompt) ? prompt : lingbotPrompt(prompt),
        negativePrompt:
          negativePrompt && looksLikeJson(negativePrompt)
            ? negativePrompt
            : lingbotNegative(negativePrompt),
      };
    case 'wan21':
    case 'wan22':
      return { prompt, negativePrompt: negativePrompt || WAN_DEFAULT_NEGATIVE };
    case 'ltx':
      return { prompt, negativePrompt: negativePrompt || LTX_DEFAULT_NEGATIVE };
  }
}
