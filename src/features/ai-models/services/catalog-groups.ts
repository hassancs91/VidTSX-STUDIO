import type { LlmProviderConfig, ProviderKeyId, ProviderModelCatalogIpc } from '@shared/ipc/types';
import { isProviderKeyId } from '@shared/providers/registry';

/** Display names for the catalog rows and cards (registry providers + LLM presets). */
const PROVIDER_LABELS: Record<string, string> = {
  fal: 'Fal',
  byteplus: 'BytePlus ModelArk',
  openrouter: 'OpenRouter',
  cloudflare: 'Cloudflare Workers AI',
  'claude-subscription': 'Claude (Subscription)',
  'claude-api': 'Claude (API key)',
  minimax: 'MiniMax',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  zai: 'Z.AI',
  kimi: 'Kimi (Moonshot)',
};

export function providerLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

const CATEGORY_WORDS: Record<string, string> = {
  image: 'image',
  video: 'video',
  llm: 'text',
};

/** Fixed catalog order: media providers by registry, then the LLM presets. */
const PROVIDER_ORDER = [
  'fal',
  'byteplus',
  'openrouter',
  'cloudflare',
  'claude-subscription',
  'claude-api',
  'minimax',
  'kimi',
  'openai',
  'gemini',
  'zai',
];

export interface ProviderCatalogGroup {
  providerId: string;
  label: string;
  /** This provider's catalogs, image → video → llm. */
  catalogs: ProviderModelCatalogIpc[];
  /** "12 image · 4 video · 5 text models" */
  summary: string;
  /** True when any of its lists differs from the shipped defaults. */
  customized: boolean;
  /** The provider has a key / sign-in, so its models are usable right now. */
  configured: boolean;
}

export interface GroupedCatalogs {
  configured: ProviderCatalogGroup[];
  unconfigured: ProviderCatalogGroup[];
}

const CATEGORY_ORDER = ['image', 'video', 'llm'];

function summarize(catalogs: ProviderModelCatalogIpc[]): string {
  const parts = catalogs.map((c) => `${c.models.length} ${CATEGORY_WORDS[c.category] ?? c.category}`);
  return `${parts.join(' · ')} model${catalogs.reduce((n, c) => n + c.models.length, 0) === 1 ? '' : 's'}`;
}

/**
 * Providers whose models are usable now: a shared key is saved, an
 * own-key LLM provider has its key, or a subscription provider is enabled.
 */
export function configuredProviderIds(
  hasKeys: Partial<Record<ProviderKeyId, boolean>>,
  llmProviders: LlmProviderConfig[],
): Set<string> {
  const ids = new Set<string>();
  for (const [id, has] of Object.entries(hasKeys)) if (has) ids.add(id);
  for (const p of llmProviders) {
    if (isProviderKeyId(p.id)) continue; // shared-credential preset: the key above decides
    if (p.authMode === 'subscription' ? p.enabled : !!p.apiKey) ids.add(p.id);
  }
  return ids;
}

/**
 * One accordion row per provider, configured providers first (in the fixed
 * order), the rest under a "without a key" caption. Pure — unit-tested.
 */
export function groupCatalogsByProvider(
  catalogs: ProviderModelCatalogIpc[],
  configuredIds: Set<string>,
): GroupedCatalogs {
  const byProvider = new Map<string, ProviderModelCatalogIpc[]>();
  for (const catalog of catalogs) {
    const list = byProvider.get(catalog.providerId) ?? [];
    list.push(catalog);
    byProvider.set(catalog.providerId, list);
  }
  const rank = (id: string) => {
    const i = PROVIDER_ORDER.indexOf(id);
    return i === -1 ? PROVIDER_ORDER.length : i;
  };
  const groups: ProviderCatalogGroup[] = [...byProvider.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([providerId, list]) => {
      const sorted = [...list].sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
      );
      return {
        providerId,
        label: providerLabel(providerId),
        catalogs: sorted,
        summary: summarize(sorted),
        customized: sorted.some((c) => !c.isDefault),
        configured: configuredIds.has(providerId),
      };
    });
  return {
    configured: groups.filter((g) => g.configured),
    unconfigured: groups.filter((g) => !g.configured),
  };
}
