// The decisions runtime (DECISION_MODELS_DESIGN.md §4, §8, §12) — the ONE entry main callers use: settings + engine + usage. The agent tool /
// flow node (part (d)) and the IPC handlers call `getDecisionRuntime()`, never the engine directly. Created on first use (the `lazily`
// registration), never at startup; a key change re-registers the presets (`decisionsKeysChanged`, called by the provider-keys save) and
// pushes a status event when a rung became available / unavailable. The status carries has-key BOOLEANS only — no key, no state text in a
// status, an event or an error (§12, §15.2).

import type { AiUsageEntry } from '../../../shared/types/ai-usage';
import type { DecisionRequest, DecisionResult, HostedDecisionProviderId } from '../../../shared/types/decisions';
import type {
  DecisionsDecideResponse,
  DecisionsEvent,
  DecisionsHostedRungStatus,
  DecisionsSettingsSetRequest,
  DecisionsStatus,
  DecisionsWireError,
} from '../../../shared/ipc/types/decisions';
import { DECISION_PROVIDER_PRESETS, DecisionError, decisionEngine, type DecideOptions, type DecisionEngine } from '../../../decision-engine';
import { WHY_NO_KEY, WHY_NO_LOCAL, WHY_SWITCHED_OFF } from '../../../decision-engine/ladder';
import { registerDecisionProviders, type DecisionCredentials, type DecisionLlmDeps } from './decision-init';
import { getDecisionSettings, setDecisionSettings, type DecisionSettings } from './decision-settings';
import { createDecisionUsageListener } from './decision-usage';

export const WHY_DECISIONS_OFF = 'Decisions are off in Settings';
/** §9: a flow / agent budget; the key test is one tiny request. */
const KEY_TEST_TIMEOUT_MS = 15_000;

export interface DecisionRuntimeDeps {
  engine: DecisionEngine;
  readSettings: () => DecisionSettings;
  writeSettings: (patch: DecisionsSettingsSetRequest) => DecisionSettings;
  readCredentials: () => Promise<DecisionCredentials>;
  llm: DecisionLlmDeps;
  appendUsage: (entry: Omit<AiUsageEntry, 'id'>) => Promise<unknown>;
  emit: (event: DecisionsEvent) => void;
}

/** A thrown decision failure as a wire error: a DecisionError keeps its code and its (already scrubbed) message. */
export function toDecisionsWireError(err: unknown): DecisionsWireError {
  if (err instanceof DecisionError) return { code: err.code, message: err.message };
  const message = err instanceof Error && err.message ? err.message : 'The decision failed.';
  return { code: 'provider-error', message: message.slice(0, 300) };
}

function presetOf(id: HostedDecisionProviderId) {
  const preset = DECISION_PROVIDER_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`No decision preset "${id}"`);
  return preset;
}

export class DecisionRuntime {
  private started: Promise<void> | null = null;
  private lastStatus = '';
  private keyTests = 0;

  constructor(private readonly deps: DecisionRuntimeDeps) {}

  /** Installs the settings resolver + the usage listener and registers from the saved keys — once (a failed start is retried). */
  start(): Promise<void> {
    if (!this.started) {
      this.started = this.boot().catch((err: unknown) => {
        this.started = null;
        throw err;
      });
    }
    return this.started;
  }

  private async boot(): Promise<void> {
    const { engine } = this.deps;
    engine.setSettingsResolver(() => {
      const { mode, hostedOrder } = this.deps.readSettings();
      return { mode, hostedOrder };
    });
    engine.setUsageListener(createDecisionUsageListener(this.deps.appendUsage));
    await this.register();
    this.lastStatus = JSON.stringify(await this.buildStatus());
  }

  private async register(): Promise<void> {
    registerDecisionProviders(this.deps.engine, {
      credentials: await this.deps.readCredentials(),
      openRouterModel: this.deps.readSettings().openRouterModel,
      llm: this.deps.llm,
    });
  }

  /** A provider key was saved or removed: re-register, and push the status if a rung changed. */
  async keysChanged(): Promise<void> {
    if (!this.started) return this.start();
    await this.started;
    await this.register();
    const status = await this.buildStatus();
    const text = JSON.stringify(status);
    if (text === this.lastStatus) return;
    this.lastStatus = text;
    this.deps.emit({ type: 'status', status });
  }

  /** The ladder (`auto`) or the pinned rung — the engine's `decide`, after the first-use start. */
  async decide(request: DecisionRequest, options: DecideOptions = {}): Promise<DecisionResult> {
    await this.start();
    return this.deps.engine.decide(request, options);
  }

  async status(): Promise<DecisionsStatus> {
    await this.start();
    return this.buildStatus();
  }

  /** Validates + writes the patch (throws on a refused one), re-registers when the OpenRouter model changed, pushes the new status. */
  async setSettings(patch: DecisionsSettingsSetRequest): Promise<DecisionsStatus> {
    await this.start();
    const before = this.deps.readSettings().openRouterModel;
    const next = this.deps.writeSettings(patch);
    if (next.openRouterModel !== before) await this.register();
    const status = await this.buildStatus();
    this.lastStatus = JSON.stringify(status);
    this.deps.emit({ type: 'status', status });
    return status;
  }

  /** The TypeSafe row's test (§8): one tiny `noul` pinned to Jev with the SAVED key; a fresh state each time, so never a cache hit. */
  async testKey(): Promise<DecisionsDecideResponse> {
    this.keyTests += 1;
    try {
      const result = await this.decide({
        state: `A key check (#${this.keyTests}, ${new Date().toISOString()}).`,
        questions: { check: { type: 'noul', instructions: 'Is this text a key check?' } },
        provider: 'jev',
        featureSource: 'decision-test',
        timeoutMs: KEY_TEST_TIMEOUT_MS,
      });
      return { ok: true, result };
    } catch (err) {
      return { ok: false, error: toDecisionsWireError(err) };
    }
  }

  private async buildStatus(): Promise<DecisionsStatus> {
    const settings = this.deps.readSettings();
    const credentials = await this.deps.readCredentials();
    const registered = this.deps.engine.getProviders();
    const off = settings.mode === 'off';
    const hosted = (id: HostedDecisionProviderId): DecisionsHostedRungStatus => {
      const preset = presetOf(id);
      const hasKey = !!credentials[preset.credentialId];
      const enabled = settings.hostedOrder.includes(id);
      const why = off ? WHY_DECISIONS_OFF : !hasKey ? WHY_NO_KEY : !enabled ? WHY_SWITCHED_OFF : !registered.includes(id) ? 'not registered' : undefined;
      return {
        id,
        name: preset.name,
        model: id === 'openrouter-decisions' ? settings.openRouterModel : preset.model,
        keyProvider: preset.credentialId,
        hasKey,
        enabled,
        available: !why,
        ...(why ? { why } : {}),
      };
    };
    const text = await this.deps.engine.checkReady('llm');
    const llm = off ? { available: false, why: WHY_DECISIONS_OFF } : text.ready ? { available: true } : { available: false, why: text.reason };
    return {
      mode: settings.mode,
      hostedOrder: [...settings.hostedOrder],
      openRouterModel: settings.openRouterModel,
      jev: hosted('jev'),
      'openrouter-decisions': hosted('openrouter-decisions'),
      local: { state: 'none', available: false, why: WHY_NO_LOCAL },
      llm,
    };
  }
}

const listeners = new Set<(event: DecisionsEvent) => void>();
let runtime: DecisionRuntime | null = null;

/** Subscribe to the push events without creating the runtime; returns the unsubscribe. */
export function onDecisionsEvent(listener: (event: DecisionsEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: DecisionsEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // a broken listener never breaks a decision
    }
  }
}

/**
 * The one runtime over the app's `decisionEngine`. The credential store, the text engine and the usage log are imported on first use
 * only, so this module's import graph (and every test that loads it) stays free of the provider chain.
 */
export function getDecisionRuntime(): DecisionRuntime {
  runtime ??= new DecisionRuntime({
    engine: decisionEngine,
    readSettings: getDecisionSettings,
    writeSettings: setDecisionSettings,
    readCredentials: async () => {
      const all = await (await import('../settings')).getProviderCredentials();
      return { typesafe: all.typesafe, openrouter: all.openrouter };
    },
    llm: {
      generate: async (request) => (await import('../../../engine/llm-engine')).llmEngine.generate(request),
      isReady: async () => (await import('../../../engine/llm-engine')).llmEngine.getActiveProvider() !== null,
    },
    appendUsage: async (entry) => (await import('../ai-usage')).aiUsageService.appendEntry(entry),
    emit,
  });
  return runtime;
}

/** The `lazily` initializer for the decisions IPC handlers. */
export async function ensureDecisions(): Promise<void> {
  await getDecisionRuntime().start();
}

/** Called after a provider-key save (provider-keys-handlers.ts): re-register only if the runtime exists — first use reads the keys anyway. */
export async function decisionsKeysChanged(): Promise<void> {
  if (runtime) await runtime.keysChanged();
}
