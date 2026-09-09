/**
 * BytePlus ModelArk video generation API types (international endpoint).
 *
 * Schema pinned from the live docs on 2026-09-07:
 * https://docs.byteplus.com/en/docs/ModelArk/1520757 (create task)
 * https://docs.byteplus.com/en/docs/ModelArk/1521309 (retrieve task)
 * https://docs.byteplus.com/en/docs/ModelArk/1521720 (cancel / delete task)
 */

export interface BytePlusClientOptions {
  apiKey: string;
  /** Override for the regional base URL (default: ap-southeast). */
  baseUrl?: string;
}

/** Where an input asset sits in the task. Omitted for a plain first frame. */
export type BytePlusContentRole =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio';

/**
 * One entry of the task's `content` array. `image_url.url` and
 * `audio_url.url` accept a public URL, an `asset://` id, or a base64 data
 * URI; **`video_url.url` accepts only a URL or asset id** — reference videos
 * must be hosted somewhere ModelArk can fetch them.
 */
export type BytePlusContentItem =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string }; role?: BytePlusContentRole }
  | { type: 'video_url'; video_url: { url: string }; role?: BytePlusContentRole }
  | { type: 'audio_url'; audio_url: { url: string }; role?: BytePlusContentRole };

export interface BytePlusCreateTaskBody {
  /** ModelArk model id, e.g. `dreamina-seedance-2-5-260628`. */
  model: string;
  content: BytePlusContentItem[];
  /** '480p' | '720p' | '1080p' | '4k', per model. */
  resolution?: string;
  /** '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '21:9' | 'adaptive'. */
  ratio?: string;
  /** Whole seconds, or -1 to let the model choose. */
  duration?: number;
  generate_audio?: boolean;
  watermark?: boolean;
  seed?: number;
  camera_fixed?: boolean;
  return_last_frame?: boolean;
  /** Seedance 2.5 only: 'auto' | 'reference' | 'edit' | 'extend'. */
  omni_reference_task_type?: string;
}

export type BytePlusTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'expired';

export interface BytePlusTask {
  id: string;
  model?: string;
  status: BytePlusTaskStatus;
  /** Present on success. The video URL is valid for 24 hours. */
  content?: { video_url?: string; last_frame_url?: string };
  /** For video models input tokens are always 0, so total = completion. */
  usage?: { completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string } | null;
  seed?: number;
  resolution?: string;
  ratio?: string;
  duration?: number;
  framespersecond?: number;
  generate_audio?: boolean;
  created_at?: number;
  updated_at?: number;
}

export interface BytePlusCreateTaskResult {
  id: string;
}

// ─── Image generation (Seedream) ───
// Schema pinned from the live docs on 2026-09-10:
// https://docs.byteplus.com/en/docs/ModelArk/1541523 (image generation API)
// https://docs.byteplus.com/en/docs/ModelArk/1824121 (Seedream 4.0–5.0 tutorial)
// https://docs.byteplus.com/en/docs/ModelArk/1330310 (model list)
// The 4.x / 5.x reference lists NO `guidance_scale` and NO `seed` (those were
// Seedream 3.0's text-to-image API). Live on 5.0 pro (2026-09-10): `seed`
// is accepted, `guidance_scale` is rejected as "not supported by the current
// model" — so only `seed` is modelled, sent when a caller sets it.

export interface BytePlusCreateImageBody {
  /** ModelArk model id, e.g. `seedream-4-5-251128`. */
  model: string;
  prompt: string;
  /**
   * Reference image(s): a public URL or a `data:image/<fmt>;base64,…` URI
   * (the format tag must be lowercase). One string for image-to-image, an
   * array for multi-reference (2–14 on 5.0 lite / 4.5 / 4.0, 2–10 on 5.0 pro).
   */
  image?: string | string[];
  /** A resolution tier (`1K` | `1.5K` | `2K` | `3K` | `4K`, per model) or `<width>x<height>`. */
  size?: string;
  seed?: number;
  /** Default true — the app always sends false. */
  watermark?: boolean;
  /** Default `url` (24 h link); the app asks for `b64_json`. */
  response_format?: 'url' | 'b64_json';
  /** `auto` lets the model return a related set; not accepted by 5.0 pro. */
  sequential_image_generation?: 'auto' | 'disabled';
  sequential_image_generation_options?: { max_images: number };
  /** 5.0 lite / 5.0 pro only; 4.x always emit jpeg. */
  output_format?: 'png' | 'jpeg';
  stream?: false;
}

export interface BytePlusImageData {
  url?: string;
  b64_json?: string;
  /** `<width>x<height>` of the output. */
  size?: string;
  output_format?: 'png' | 'jpeg';
  /** Per-image failure inside a sequential set; the other images still arrive. */
  error?: { code?: string; message?: string };
}

export interface BytePlusCreateImageResult {
  model?: string;
  created?: number;
  data?: BytePlusImageData[];
  usage?: {
    generated_images?: number;
    /** round(sum(width × height) / 256). */
    output_tokens?: number;
    total_tokens?: number;
  };
  /** Top-level failure: no image was generated. */
  error?: { code?: string; message?: string };
}
