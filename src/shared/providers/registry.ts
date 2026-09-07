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

export type ProviderCapability = 'llm' | 'image' | 'video' | 'stt';

/** Engine whose test button a key row offers. Only 'image' has a handler today. */
export type ProviderTestKind = 'image' | 'video' | 'llm';

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
    keyHint: 'console.byteplus.com/ark → API keys — Seedance video, direct',
    keyPlaceholder: 'ARK API key',
    capabilities: ['video'],
    test: 'video',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    keyHint: 'openrouter.ai/keys',
    keyPlaceholder: 'sk-or-…',
    capabilities: ['image', 'llm', 'stt'],
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
    capabilities: ['stt'],
  },
  {
    id: 'zai',
    name: 'Z.AI',
    keyHint: 'z.ai/model-api — GLM models',
    keyPlaceholder: 'API key',
    capabilities: ['llm'],
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
};

export function isProviderKeyId(value: string): value is ProviderKeyId {
  return (PROVIDER_KEY_IDS as readonly string[]).includes(value);
}

export function getProviderDefinition(id: ProviderKeyId): ProviderDefinition {
  const def = PROVIDER_REGISTRY.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown provider "${id}"`);
  return def;
}
