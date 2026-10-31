/**
 * Provider registry — the single definition of every shared bring-your-own-key
 * provider. Everything else derives from it: the `ProviderKeyId` union and
 * `ProviderCredentials` shape, the Providers page key rows (label, hint,
 * placeholder, capability badges, test button), and the credential lookup in
 * each engine's init (`credentials[preset.credentialId]`).
 *
 * Adding a provider = one entry here + a `credentialId` on the engine preset
 * that consumes it (docs/video-providers-plan.md §2.1).
 *
 * Order matters: the Providers page renders rows in registry order, and each
 * entry's `capabilities` array is the badge order.
 */

export type ProviderCapability = 'llm' | 'image' | 'video' | 'stt' | 'audio' | 'decision';

/**
 * Engine whose test button a key row offers. 'decision' = one tiny `noul` pinned to Jev with the SAVED key, through
 * `decisions:decide` `{ test: 'jev' }` (DECISION_MODELS_DESIGN.md §8) — no key crosses the decisions IPC.
 */
export type ProviderTestKind = 'image' | 'video' | 'llm' | 'decision';

export interface ProviderExtraField {
  /** Plain (non-secret) settings field that rides along with the key. */
  key: 'cloudflareAccountId';
  hint: string;
  placeholder: string;
}

/** Entry shape as written; `ProviderDefinition` narrows `id` to the union. */
interface ProviderDefinitionShape {
  id: string;
  /** Row label on the Providers page. */
  name: string;
  /** Where to get the key (shown under the label). */
  keyHint: string;
  keyPlaceholder: string;
  capabilities: readonly ProviderCapability[];
  /** Extra non-secret field rendered under the key input. */
  extraField?: ProviderExtraField;
  /** Which engine test button the row offers; absent = no test button. */
  test?: ProviderTestKind;
}

const REGISTRY = [
  {
    id: 'fal',
    name: 'Fal',
    keyHint: 'fal.ai/dashboard/keys',
    keyPlaceholder: 'key_id:key_secret',
    capabilities: ['image', 'video'],
    test: 'image',
  },
  {
    id: 'byteplus',
    name: 'BytePlus ModelArk',
    keyHint: 'console.byteplus.com/ark → API keys — Seedance video + Seedream images, direct',
    keyPlaceholder: 'ARK API key',
    capabilities: ['video', 'image'],
    test: 'video',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyHint: 'openrouter.ai/keys',
    keyPlaceholder: 'sk-or-…',
    // 'decision': the same key unlocks Microsoft-Decision-1 over OpenRouter's Decisions API (src/decision-engine).
    capabilities: ['image', 'llm', 'stt', 'decision'],
    test: 'image',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers AI',
    keyHint: 'dash.cloudflare.com → API tokens (Workers AI scope) — 10k free neurons/day',
    keyPlaceholder: 'API token',
    capabilities: ['image'],
    // The account id half of the pair is not a secret and lives in a plain
    // settings field (`cloudflareAccountId`).
    extraField: {
      key: 'cloudflareAccountId',
      hint: 'Account ID — dash.cloudflare.com, right sidebar of your account home (not a secret)',
      placeholder: 'Cloudflare account ID',
    },
    test: 'image',
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    keyHint: 'assemblyai.com — word timing + speakers',
    keyPlaceholder: 'API key',
    capabilities: ['stt'],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    keyHint: 'elevenlabs.io — Scribe transcription',
    keyPlaceholder: 'API key',
    // W2b: the same key unlocks sound effects + music (src/audio-engine/generation).
    capabilities: ['stt', 'audio'],
  },
  {
    id: 'zai',
    name: 'Z.AI',
    keyHint: 'z.ai/model-api — GLM models',
    keyPlaceholder: 'API key',
    capabilities: ['llm'],
  },
  {
    // Jev (jev-1.14.0) — typed questions → probabilities (DECISION_MODELS_DESIGN.md §8, E-f).
    id: 'typesafe',
    name: 'TypeSafe',
    keyHint: 'typesafe.ai → API keys — Jev decisions',
    keyPlaceholder: 'TypeSafe API key',
    capabilities: ['decision'],
    test: 'decision',
  },
] as const satisfies readonly ProviderDefinitionShape[];

/** Union of registry ids — replaces the hand-written credentials interface. */
export type ProviderKeyId = (typeof REGISTRY)[number]['id'];

export interface ProviderDefinition extends ProviderDefinitionShape {
  id: ProviderKeyId;
}

export const PROVIDER_REGISTRY: readonly ProviderDefinition[] = REGISTRY;

/**
 * Shared BYOK credentials, one key per provider. Entered once in Providers
 * and consumed by every engine (LLM, image, video, transcription). Raw keys
 * never cross the IPC boundary to the renderer — only has-key booleans do.
 */
export type ProviderCredentials = Partial<Record<ProviderKeyId, string>>;

export const PROVIDER_KEY_IDS: readonly ProviderKeyId[] = PROVIDER_REGISTRY.map((p) => p.id);

/** Badge text per capability (Providers page). */
export const PROVIDER_CAPABILITY_LABELS: Record<ProviderCapability, string> = {
  image: 'Images',
  video: 'Video',
  llm: 'LLMs',
  stt: 'Transcription',
  audio: 'Sound & music',
  decision: 'Decisions',
};

export function isProviderKeyId(value: string): value is ProviderKeyId {
  return (PROVIDER_KEY_IDS as readonly string[]).includes(value);
}

export function getProviderDefinition(id: ProviderKeyId): ProviderDefinition {
  const def = PROVIDER_REGISTRY.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown provider "${id}"`);
  return def;
}
