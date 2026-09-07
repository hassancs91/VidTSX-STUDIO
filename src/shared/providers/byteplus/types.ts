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
