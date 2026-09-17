import { imageEngine, IMAGE_PROVIDER_PRESETS } from '../../image-engine';
import { LocalSdImageProvider } from '../../image-engine/providers/local-sd-provider';
import { GeminiCliImageProvider } from '../../image-engine/providers/gemini-cli-provider';
import { CodexCliImageProvider } from '../../image-engine/providers/codex-cli-provider';
import { agyCliService } from './agy-cli';
import { codexCliService } from './codex-cli';
import { installContentSafetyGuard } from './content-safety/install';
import { loadSettings, getProviderCredentials, getCloudflareAccountId } from './settings';
import { getProviderImageModels } from './provider-models';
import { applySdGenerationPreflight } from './sdimage-preflight';
import { resolveImageModelParams } from './image-model-params';
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('ImageInit');

/** Stable id of the on-device sd-cli provider. */
export const LOCAL_IMAGE_PROVIDER_ID = 'local';

/** Stable id of the Antigravity (Google subscription) CLI provider. */
export const GEMINI_CLI_IMAGE_PROVIDER_ID = 'gemini-cli';

/** Stable id of the OpenAI Codex (ChatGPT subscription) CLI provider. */
export const CODEX_CLI_IMAGE_PROVIDER_ID = 'codex-cli';

/**
 * Providers registered as instances (no API key, never stored in provider
 * settings). Settings-save filters these ids out. The deferred MiniMax/mmx
 * provider joins this list when it lands.
 */
export const INSTANCE_IMAGE_PROVIDER_IDS: readonly string[] = [
  LOCAL_IMAGE_PROVIDER_ID,
  GEMINI_CLI_IMAGE_PROVIDER_ID,
  CODEX_CLI_IMAGE_PROVIDER_ID,
];

/**
 * (Re-)register the local sd-cli bridge with the cloud image engine. Safe to
 * call repeatedly — settings saves rebuild the provider registry, so this runs
 * again after each rebuild. Registered even when sd-cli/models are missing:
 * the provider then reports zero models and the UI hides it.
 */
export function registerLocalImageProvider(): void {
  // Guard first: any caller that can register a provider can trigger a
  // generation, and the engine refuses to run without Gate B installed.
  installContentSafetyGuard();
  imageEngine.setParamResolver(resolveImageModelParams);
  if (imageEngine.getProviders().includes(LOCAL_IMAGE_PROVIDER_ID)) return;
  imageEngine.registerInstance(
    new LocalSdImageProvider(LOCAL_IMAGE_PROVIDER_ID, {
      prepare: async (request) => (await applySdGenerationPreflight(request)).request,
    }),
  );
}

/**
 * (Re-)register the Antigravity CLI bridge (Nano Banana 2 on the Google AI
 * subscription). Always registered; it reports zero models until the CLI is
 * detected and authenticated (probed lazily on first model listing — no CLI
 * spawn at startup). Content Safety needs nothing provider-specific: the
 * engine's fail-closed runGuarded chokepoint covers this provider like any
 * other.
 */
export function registerGeminiCliImageProvider(): void {
  installContentSafetyGuard();
  if (imageEngine.getProviders().includes(GEMINI_CLI_IMAGE_PROVIDER_ID)) return;
  imageEngine.registerInstance(
    new GeminiCliImageProvider(GEMINI_CLI_IMAGE_PROVIDER_ID, agyCliService),
  );
}

/**
 * (Re-)register the OpenAI Codex CLI bridge (GPT Image 2 on the ChatGPT
 * subscription — docs/ai-models-redesign.md §3.7). Same rules as the
 * Antigravity one: always registered, zero models until the CLI is detected
 * and signed in, probed lazily on the first model listing.
 */
export function registerCodexCliImageProvider(): void {
  installContentSafetyGuard();
  if (imageEngine.getProviders().includes(CODEX_CLI_IMAGE_PROVIDER_ID)) return;
  imageEngine.registerInstance(
    new CodexCliImageProvider(CODEX_CLI_IMAGE_PROVIDER_ID, codexCliService),
  );
}

export async function initImageEngine(): Promise<void> {
  installContentSafetyGuard();
  // Per-model parameter overrides (W2c): read per request, never cached.
  imageEngine.setParamResolver(resolveImageModelParams);
  try {
    const settings = await loadSettings();
    const credentials = await getProviderCredentials();
    const saved = settings.imageProviders ?? [];

    // One key unlocks the provider: every preset with its shared BYOK
    // credential (or a legacy per-provider key) registers, regardless of the
    // legacy per-provider `enabled` flag. Model lists come from the editable
    // provider catalogs (AI page → Providers → Model Catalogs).
    for (const preset of IMAGE_PROVIDER_PRESETS) {
      const config = saved.find((p) => p.id === preset.id) ?? preset;
      const apiKey = credentials[preset.credentialId] || config.apiKey;
      if (!apiKey) continue;
      // Cloudflare needs both credential halves — without the account id the
      // run URL can't be built, so the provider stays unregistered.
      const accountId = preset.type === 'cloudflare' ? await getCloudflareAccountId() : undefined;
      if (preset.type === 'cloudflare' && !accountId) continue;
      try {
        imageEngine.register({
          ...config,
          apiKey,
          accountId,
          enabled: true,
          models: await getProviderImageModels(preset.id),
        });
      } catch (err) {
        log.warn(`Failed to register provider "${config.id}"`, { error: err instanceof Error ? err.message : String(err) });
      }
    }
    // Cloud providers require an API key; the CLI bridges do not and are
    // always registered (after the cloud ones, so they never steal "active"
    // from a configured cloud provider).
    registerLocalImageProvider();
    registerGeminiCliImageProvider();
    registerCodexCliImageProvider();

    // Restore last active provider
    if (settings.imageActiveProvider) {
      try {
        imageEngine.switchProvider(settings.imageActiveProvider);
      } catch {
        // Provider not registered — engine keeps its own default
      }
    }

    const providers = imageEngine.getProviders();
    const active = imageEngine.getActiveProvider();
    log.info('Engine initialized', { providerCount: providers.length, active: active ?? 'none' });
  } catch (err) {
    log.warn('Engine initialization failed (non-fatal)', { error: err instanceof Error ? err.message : String(err) });
  }
}
