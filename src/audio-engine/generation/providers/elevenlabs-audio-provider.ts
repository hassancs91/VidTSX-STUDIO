// ElevenLabs sound effects + music (V1 completion plan §2.2 W2b), one more
// endpoint pair on the same API the Scribe STT provider uses. Both calls are
// synchronous: bytes back on 200, a JSON `detail` on failure.
//
// Verified against the API reference on 2026-09-10:
//   POST /v1/sound-generation  body { text, model_id, duration_seconds?,
//        prompt_influence?, loop? }  — duration 0.5–30 s or auto
//   POST /v1/music             body { model_id, prompt | composition_plan,
//        music_length_ms?, force_instrumental?, seed? } — 3 000–600 000 ms;
//        `music_length_ms` rides with a prompt only, `seed` with a plan only.
// The plan's `duration_ms` was a stale name; the field is `music_length_ms`.
// `output_format` is a query parameter on both.

import type {
  AudioCompositionPlan,
  AudioGenerationKind,
  AudioGenerationProvider,
  AudioProviderRequest,
  AudioProviderResult,
} from '../types';
import { AudioGenerationError } from '../types';

const BASE_URL = 'https://api.elevenlabs.io/v1';

export const ELEVENLABS_SFX_MODEL = 'eleven_text_to_sound_v2';
export const ELEVENLABS_MUSIC_MODEL = 'music_v2';

/** Pay-as-you-go API rates (elevenlabs.io/pricing/api, 2026-09-10): sound
 *  effects $0.12 per minute, Eleven Music $0.15 per minute. */
export const ELEVENLABS_AUDIO_PRICE_PER_SECOND_USD: Record<AudioGenerationKind, number> = {
  sfx: 0.12 / 60,
  music: 0.15 / 60,
};

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Wire form of a composition plan (`snake_case`, `duration_ms`). */
export function toCompositionPlanBody(plan: AudioCompositionPlan): Record<string, unknown> {
  return {
    positive_global_styles: plan.positiveGlobalStyles ?? [],
    negative_global_styles: plan.negativeGlobalStyles ?? [],
    sections: plan.sections.map((s) => ({
      section_name: s.name,
      positive_local_styles: s.positiveStyles ?? [],
      negative_local_styles: s.negativeStyles ?? [],
      duration_ms: Math.round(s.durationSec * 1000),
      lines: s.lines ?? [],
    })),
  };
}

/** The exact JSON body for one request — exported so tests pin the wire. */
export function buildElevenLabsAudioBody(req: AudioProviderRequest): Record<string, unknown> {
  if (req.kind === 'sfx') {
    return {
      text: req.prompt ?? '',
      model_id: ELEVENLABS_SFX_MODEL,
      ...(req.durationSec !== undefined ? { duration_seconds: req.durationSec } : {}),
      ...(req.promptInfluence !== undefined ? { prompt_influence: req.promptInfluence } : {}),
      ...(req.loop !== undefined ? { loop: req.loop } : {}),
    };
  }
  const body: Record<string, unknown> = {
    model_id: ELEVENLABS_MUSIC_MODEL,
    ...(req.instrumental !== undefined ? { force_instrumental: req.instrumental } : {}),
  };
  if (req.compositionPlan) {
    body.composition_plan = toCompositionPlanBody(req.compositionPlan);
    if (req.seed !== undefined) body.seed = req.seed;
  } else {
    body.prompt = req.prompt ?? '';
    if (req.durationSec !== undefined) body.music_length_ms = Math.round(req.durationSec * 1000);
  }
  return body;
}

export function elevenLabsAudioUrl(kind: AudioGenerationKind, outputFormat: string): string {
  const route = kind === 'sfx' ? 'sound-generation' : 'music';
  return `${BASE_URL}/${route}?output_format=${encodeURIComponent(outputFormat)}`;
}

export class ElevenLabsAudioProvider implements AudioGenerationProvider {
  private readonly fetchImpl: FetchLike;

  constructor(
    readonly id: string,
    private readonly apiKey: string,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  pricePerSecondUsd(kind: AudioGenerationKind): number {
    return ELEVENLABS_AUDIO_PRICE_PER_SECOND_USD[kind];
  }

  async generate(req: AudioProviderRequest): Promise<AudioProviderResult> {
    const body = buildElevenLabsAudioBody(req);
    let response: Response;
    try {
      response = await this.fetchImpl(elevenLabsAudioUrl(req.kind, req.outputFormat), {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        ...(req.signal ? { signal: req.signal } : {}),
      });
    } catch (error) {
      if (req.signal?.aborted) throw new AudioGenerationError('Cancelled', this.id);
      throw new AudioGenerationError(
        `Network error connecting to ElevenLabs: ${error instanceof Error ? error.message : String(error)}`,
        this.id,
      );
    }
    if (!response.ok) {
      throw new AudioGenerationError(await failureMessage(response, req.kind), this.id, response.status);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) throw new AudioGenerationError('ElevenLabs returned an empty file', this.id);
    return {
      bytes,
      contentType: response.headers.get('content-type') ?? 'audio/mpeg',
      model: req.kind === 'sfx' ? ELEVENLABS_SFX_MODEL : ELEVENLABS_MUSIC_MODEL,
    };
  }
}

/**
 * A 401/403 is a key problem — and on this API often a PERMISSION problem
 * (a key scoped to speech-to-text only), so the body's `detail` is kept:
 * it names the missing permission, which is what the user has to change.
 */
async function failureMessage(response: Response, kind: AudioGenerationKind): Promise<string> {
  const detail = await detailMessage(response);
  const what = kind === 'sfx' ? 'sound effects' : 'music';
  if (response.status === 401 || response.status === 403) {
    return `ElevenLabs rejected the API key for ${what}${detail ? ` (${detail})` : ''} — check the key's permissions in the ElevenLabs dashboard, or enter a key with ${what} access in AI → Providers.`;
  }
  return detail ? `ElevenLabs returned ${response.status}: ${detail}` : `ElevenLabs returned ${response.status}`;
}

async function detailMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as {
      detail?: { message?: string; status?: string } | string;
    };
    if (typeof body.detail === 'string') return body.detail;
    if (body.detail?.message) {
      return body.detail.status ? `${body.detail.status}: ${body.detail.message}` : body.detail.message;
    }
  } catch {
    // not JSON
  }
  return undefined;
}
