// The audio generation engine (V1 completion plan §2.2 W2b, §4): the ONE seam
// every SFX/music caller goes through — the Studio tools, the Agents tool,
// the IPC, later a Flows node. It validates the request against the kind's
// bounds, calls the provider, and hands the usage sink one record per
// successful generation. Content Safety: audio prompts are NOT gated
// (CONTENT_SAFETY_DESIGN.md D0.2 — Gate A is defined on visual fields only).

import { estimateMp3DurationSec } from './mp3-duration';
import { ElevenLabsAudioProvider } from './providers/elevenlabs-audio-provider';
import {
  AudioGenerationError,
  DEFAULT_AUDIO_OUTPUT_FORMAT,
  MUSIC_MAX_SECONDS,
  MUSIC_MIN_SECONDS,
  SFX_MAX_SECONDS,
  SFX_MIN_SECONDS,
  type AudioGenerationProvider,
  type AudioGenerationRequest,
  type AudioGenerationResult,
  type AudioProviderConfig,
  type AudioProviderRequest,
  type AudioUsageLogger,
} from './types';

/** Throws on a request the API would reject; returns the provider form. */
export function validateAudioRequest(req: AudioGenerationRequest): AudioProviderRequest {
  const prompt = req.prompt?.trim();
  if (req.kind === 'sfx') {
    if (!prompt) throw new Error('A sound effect needs a prompt describing the sound.');
    if (req.durationSec !== undefined && (req.durationSec < SFX_MIN_SECONDS || req.durationSec > SFX_MAX_SECONDS)) {
      throw new Error(`Sound effects run ${SFX_MIN_SECONDS}–${SFX_MAX_SECONDS} s (asked for ${req.durationSec} s).`);
    }
    if (req.promptInfluence !== undefined && (req.promptInfluence < 0 || req.promptInfluence > 1)) {
      throw new Error('promptInfluence is 0–1.');
    }
    return {
      kind: 'sfx',
      prompt,
      ...(req.durationSec !== undefined ? { durationSec: req.durationSec } : {}),
      ...(req.loop !== undefined ? { loop: req.loop } : {}),
      ...(req.promptInfluence !== undefined ? { promptInfluence: req.promptInfluence } : {}),
      outputFormat: req.outputFormat ?? DEFAULT_AUDIO_OUTPUT_FORMAT,
      ...(req.signal ? { signal: req.signal } : {}),
    };
  }
  const hasPlan = Boolean(req.compositionPlan);
  if (hasPlan && prompt) throw new Error('Music takes a prompt OR a composition plan, not both.');
  if (!hasPlan && !prompt) throw new Error('Music needs a prompt or a composition plan.');
  if (hasPlan && req.compositionPlan!.sections.length === 0) {
    throw new Error('A composition plan needs at least one section.');
  }
  if (req.durationSec !== undefined && (req.durationSec < MUSIC_MIN_SECONDS || req.durationSec > MUSIC_MAX_SECONDS)) {
    throw new Error(`Music runs ${MUSIC_MIN_SECONDS}–${MUSIC_MAX_SECONDS} s (asked for ${req.durationSec} s).`);
  }
  if (req.seed !== undefined && !hasPlan) {
    throw new Error('A seed only applies with a composition plan (the API ignores it on a prompt).');
  }
  return {
    kind: 'music',
    ...(hasPlan ? { compositionPlan: req.compositionPlan } : { prompt }),
    ...(req.durationSec !== undefined && !hasPlan ? { durationSec: req.durationSec } : {}),
    ...(req.seed !== undefined ? { seed: req.seed } : {}),
    ...(req.instrumental !== undefined ? { instrumental: req.instrumental } : {}),
    outputFormat: req.outputFormat ?? DEFAULT_AUDIO_OUTPUT_FORMAT,
    ...(req.signal ? { signal: req.signal } : {}),
  };
}

/** A plan's total length, for the usage row and the asset description. */
function planDurationSec(req: AudioProviderRequest): number | undefined {
  if (!req.compositionPlan) return undefined;
  return req.compositionPlan.sections.reduce((sum, s) => sum + s.durationSec, 0);
}

export class AudioGenerationEngine {
  private providers = new Map<string, AudioGenerationProvider>();
  private activeId: string | null = null;
  private usageLogger: AudioUsageLogger | null = null;

  setUsageLogger(logger: AudioUsageLogger | null): void {
    this.usageLogger = logger;
  }

  register(config: AudioProviderConfig): void {
    if (!config.enabled) return;
    if (!config.apiKey) throw new Error(`API key required for audio provider "${config.id}"`);
    if (config.type !== 'elevenlabs') throw new Error(`Unknown audio provider type "${String(config.type)}"`);
    this.registerInstance(new ElevenLabsAudioProvider(config.id, config.apiKey));
  }

  /** Test seam and the door for a keyless provider later. */
  registerInstance(provider: AudioGenerationProvider): void {
    this.providers.set(provider.id, provider);
    this.activeId ??= provider.id;
  }

  unregister(id: string): void {
    this.providers.delete(id);
    if (this.activeId === id) this.activeId = this.providers.keys().next().value ?? null;
  }

  getProviders(): string[] {
    return [...this.providers.keys()];
  }

  getActiveProvider(): string | null {
    return this.activeId;
  }

  /** Published rate for a kind on a provider (the active one by default). */
  getPricePerSecondUsd(kind: AudioGenerationRequest['kind'], providerId?: string): number | undefined {
    const provider = this.providers.get(providerId ?? this.activeId ?? '');
    return provider?.pricePerSecondUsd(kind);
  }

  async generate(req: AudioGenerationRequest): Promise<AudioGenerationResult> {
    const providerId = req.providerId ?? this.activeId;
    const provider = providerId ? this.providers.get(providerId) : undefined;
    if (!provider || !providerId) {
      throw new AudioGenerationError(
        req.providerId
          ? `Audio provider "${req.providerId}" is not configured.`
          : 'No audio provider is configured. Add an ElevenLabs key in AI → Providers.',
        req.providerId ?? 'none',
      );
    }
    const providerReq = validateAudioRequest(req);
    const started = Date.now();
    const result = await provider.generate(providerReq);
    const elapsedMs = Date.now() - started;
    const durationSec =
      providerReq.durationSec ??
      planDurationSec(providerReq) ??
      estimateMp3DurationSec(result.bytes, providerReq.outputFormat);
    const rate = provider.pricePerSecondUsd(req.kind);
    const costUsd = rate !== undefined ? Math.round(rate * durationSec * 1e6) / 1e6 : undefined;

    this.usageLogger?.({
      providerId,
      model: result.model,
      kind: req.kind,
      featureSource: req.featureSource ?? 'other',
      ...(req.agentId ? { agentId: req.agentId } : {}),
      durationSec,
      costUsd: costUsd ?? 0,
      elapsedMs,
    });

    return {
      providerId,
      model: result.model,
      kind: req.kind,
      bytes: result.bytes,
      contentType: result.contentType,
      ext: '.mp3',
      durationSec,
      elapsedMs,
      ...(costUsd !== undefined ? { costUsd } : {}),
    };
  }
}

/** Test seam. Production uses the singleton below. */
export function createAudioGenerationEngine(): AudioGenerationEngine {
  return new AudioGenerationEngine();
}

export const audioGenerationEngine = new AudioGenerationEngine();
