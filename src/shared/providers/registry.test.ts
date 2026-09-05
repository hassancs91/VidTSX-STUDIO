// The provider registry is the single source of truth for shared BYOK
// credentials (docs/video-providers-plan.md §2.1). These tests pin the
// contract every engine preset and the Providers page rely on: preset
// `credentialId`s resolve to a registry entry, the registry is exactly the
// `ProviderKeyId` union, and the capability badges match the engines that
// actually consume each key.
import { describe, expect, it } from 'vitest';
import {
  PROVIDER_REGISTRY,
  PROVIDER_KEY_IDS,
  PROVIDER_CAPABILITY_LABELS,
  isProviderKeyId,
  type ProviderCapability,
  type ProviderKeyId,
} from './registry';
import { PROVIDER_PRESETS } from '../../engine/presets';
import { IMAGE_PROVIDER_PRESETS } from '../../image-engine/presets';
import { STT_PROVIDER_PRESETS } from '../../transcription-engine/presets';

const registryIds = new Set<string>(PROVIDER_KEY_IDS);

describe('provider registry', () => {
  it('has unique ids and a badge label for every capability', () => {
    expect(new Set(PROVIDER_KEY_IDS).size).toBe(PROVIDER_REGISTRY.length);
    for (const entry of PROVIDER_REGISTRY) {
      expect(entry.capabilities.length).toBeGreaterThan(0);
      for (const cap of entry.capabilities) {
        expect(PROVIDER_CAPABILITY_LABELS[cap]).toBeTruthy();
      }
    }
  });

  it('registry ids equal the ProviderKeyId union', () => {
    // Compile-time half: a Record keyed by the union must be satisfiable from
    // the runtime ids and vice versa. If the union and the array ever
    // diverge, one of these two assignments stops type-checking.
    const fromUnion: Record<ProviderKeyId, true> = {
      fal: true,
      openrouter: true,
      cloudflare: true,
      assemblyai: true,
      elevenlabs: true,
      zai: true,
    };
    const fromRuntime = Object.fromEntries(PROVIDER_KEY_IDS.map((id) => [id, true])) as Record<
      ProviderKeyId,
      true
    >;
    expect(fromRuntime).toEqual(fromUnion);
    // Runtime half: the guard agrees with the array.
    for (const id of PROVIDER_KEY_IDS) expect(isProviderKeyId(id)).toBe(true);
    expect(isProviderKeyId('byteplus')).toBe(false);
  });

  it('every engine preset credentialId exists in the registry', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.credentialId) expect(registryIds.has(preset.credentialId)).toBe(true);
    }
    for (const preset of IMAGE_PROVIDER_PRESETS) {
      expect(registryIds.has(preset.credentialId)).toBe(true);
    }
    for (const preset of STT_PROVIDER_PRESETS) {
      if (preset.credentialId) expect(registryIds.has(preset.credentialId)).toBe(true);
    }
  });

  it('capability badges match the engine presets that consume each key', () => {
    // Video has no engine preset until Stage 2 (fal is wired directly in
    // video-generation.ts), so only the three preset-backed capabilities are
    // cross-checked here, in both directions: no badge without a consuming
    // engine, and no consuming engine without a badge.
    const consumers: Record<Exclude<ProviderCapability, 'video'>, Set<string>> = {
      llm: new Set(PROVIDER_PRESETS.flatMap((p) => (p.credentialId ? [p.credentialId] : []))),
      image: new Set(IMAGE_PROVIDER_PRESETS.map((p) => p.credentialId)),
      stt: new Set(STT_PROVIDER_PRESETS.flatMap((p) => (p.credentialId ? [p.credentialId] : []))),
    };
    for (const entry of PROVIDER_REGISTRY) {
      for (const cap of ['llm', 'image', 'stt'] as const) {
        const declared = entry.capabilities.includes(cap);
        const consumed = consumers[cap].has(entry.id);
        expect({ id: entry.id, cap, declared }).toEqual({ id: entry.id, cap, declared: consumed });
      }
    }
  });
});
