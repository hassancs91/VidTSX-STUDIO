import { useState } from 'react';
import { Eye, EyeOff, Check, X, Loader2 } from 'lucide-react';
import { Button, Panel, StatusBadge, TextInput, SectionHeader } from '@shared/components';
import { Select } from '@shared/components/Select';
import { useProviderKeys } from '@renderer/hooks/useProviderKeys';
import { useLlmProviders } from '@renderer/hooks/useLlmProviders';
import type { LlmProviderConfig, ProviderKeyId } from '@shared/ipc/types';
import { isFeatureEnabled } from '@shared/feature-flags';
import { CapabilityBadge } from './CapabilityBadge';
import { LlmProviderRow, type LlmProviderTestState } from './LlmProviderRow';
import { CustomProviderForm } from './CustomProviderForm';

const isCustomProvider = (id: string) => id.startsWith('custom-');

interface SharedKeyRowDef {
  id: ProviderKeyId;
  label: string;
  hint: string;
  placeholder: string;
  capabilities: string[];
  /** Row offers a live image-generation test (fal / OpenRouter). */
  imageTest?: boolean;
}

/** One key per provider — every capability it powers uses the same credential. */
const SHARED_KEY_ROWS: SharedKeyRowDef[] = [
  {
    id: 'fal',
    label: 'Fal',
    hint: 'fal.ai/dashboard/keys',
    placeholder: 'key_id:key_secret',
    capabilities: ['Images', 'Video'],
    imageTest: true,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    hint: 'openrouter.ai/keys',
    placeholder: 'sk-or-…',
    capabilities: ['Images', 'LLMs'],
    imageTest: true,
  },
  {
    id: 'assemblyai',
    label: 'AssemblyAI',
    hint: 'assemblyai.com — word timing + speakers',
    placeholder: 'API key',
    capabilities: ['Transcription'],
  },
  {
    id: 'zai',
    label: 'Z.AI',
    hint: 'z.ai/model-api — GLM models',
    placeholder: 'API key',
    capabilities: ['LLMs'],
  },
];

/** LLM providers whose key lives in their own provider config (not shared). */
const LLM_ONLY_IDS = new Set(['claude-subscription', 'claude-api', 'openai', 'gemini', 'minimax']);

interface ImageTestState {
  testing: boolean;
  success?: boolean;
  durationMs?: number;
  error?: string;
}

/**
 * The unified provider list: every credential the app can use, in one place.
 * Shared BYOK keys (fal / OpenRouter / AssemblyAI / Z.AI) power all their
 * capabilities at once; LLM-only providers (Claude / OpenAI / Gemini /
 * MiniMax / custom endpoints) carry their key on the provider entry itself.
 */
export function ApiKeysSection() {
  const { hasKeys, loading: keysLoading, saving: keysSaving, error: keysError, saveKeys } = useProviderKeys();
  const llm = useLlmProviders();

  const [drafts, setDrafts] = useState<Partial<Record<ProviderKeyId, string>>>({});
  const [clearing, setClearing] = useState<ProviderKeyId[]>([]);
  const [visible, setVisible] = useState<Partial<Record<ProviderKeyId, boolean>>>({});
  const [llmDirty, setLlmDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [imageTests, setImageTests] = useState<Partial<Record<ProviderKeyId, ImageTestState>>>({});

  const keysDirty = clearing.length > 0 || Object.values(drafts).some((v) => v && v.trim().length > 0);
  const dirty = keysDirty || llmDirty;
  const saving = keysSaving || llm.saving;

  const handleSave = async () => {
    let ok = true;
    if (keysDirty) {
      ok = (await saveKeys(drafts, clearing.length ? clearing : undefined)) && ok;
      if (ok) {
        setDrafts({});
        setClearing([]);
      }
    }
    if (llmDirty) {
      ok = (await llm.saveProviders()) && ok;
      if (ok) setLlmDirty(false);
    }
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    }
  };

  const updateLlm = (id: string, updates: Partial<LlmProviderConfig>) => {
    llm.updateProvider(id, updates);
    setLlmDirty(true);
  };

  const testImageProvider = async (id: ProviderKeyId) => {
    setImageTests((prev) => ({ ...prev, [id]: { testing: true } }));
    try {
      const result = await window.api.imageProviderTest({ providerId: id, apiKey: drafts[id]?.trim() || undefined });
      setImageTests((prev) => ({
        ...prev,
        [id]: { testing: false, success: result.success, durationMs: result.durationMs, error: result.error },
      }));
    } catch {
      setImageTests((prev) => ({ ...prev, [id]: { testing: false, success: false, error: 'Test request failed' } }));
    }
  };

  if (keysLoading || llm.loading) {
    return (
      <Panel className="p-3">
        <div className="text-[12px] text-text-muted">Loading providers…</div>
      </Panel>
    );
  }

  const llmRows = llm.providers.filter((p) => LLM_ONLY_IDS.has(p.id) || isCustomProvider(p.id));
  const enabledLlmProviders = llm.providers.filter((p) => p.enabled);

  return (
    <div>
      <SectionHeader>Providers &amp; API Keys</SectionHeader>
      <div className="text-[10px] text-text-dim -mt-1 mb-3">
        Bring your own keys — entered once, used by every feature the provider powers. Keys are
        stored locally on this machine and never sent anywhere except the provider itself.
      </div>

      <Panel>
        {/* Shared BYOK keys */}
        {SHARED_KEY_ROWS.map((row) => {
          const saved = hasKeys[row.id] && !clearing.includes(row.id);
          const test = imageTests[row.id];
          return (
            <div key={row.id} className="p-3" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12px] text-text-secondary font-medium">{row.label}</span>
                  {row.capabilities.map((cap) => (
                    <CapabilityBadge key={cap} label={cap} />
                  ))}
                  {saved && !drafts[row.id] && (
                    <StatusBadge tone="success">Key saved</StatusBadge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {row.imageTest && (
                    <button
                      onClick={() => testImageProvider(row.id)}
                      disabled={test?.testing || (!saved && !drafts[row.id]?.trim())}
                      className="text-[10px] text-text-dim hover:text-text-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      title="Generates a tiny test image with this key"
                      type="button"
                    >
                      {test?.testing ? (
                        <span className="flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Testing…</span>
                      ) : (
                        'Test'
                      )}
                    </button>
                  )}
                  {saved && (
                    <button
                      onClick={() => setClearing((prev) => [...prev, row.id])}
                      className="text-[10px] text-text-dim hover:text-accent-red transition-colors cursor-pointer"
                      title="Remove this key on save"
                      type="button"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="text-[10px] text-text-dim mb-1">{row.hint}</div>
              <div className="flex items-center gap-1">
                <TextInput
                  type={visible[row.id] ? 'text' : 'password'}
                  value={drafts[row.id] ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDrafts((prev) => ({ ...prev, [row.id]: value }));
                    setClearing((prev) => prev.filter((id) => id !== row.id));
                  }}
                  placeholder={
                    clearing.includes(row.id)
                      ? 'Key will be removed on save'
                      : saved
                        ? 'Enter new key to replace…'
                        : row.placeholder
                  }
                  className="flex-1"
                />
                <button
                  className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] text-text-muted hover:bg-app-hover transition-colors"
                  onClick={() => setVisible((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                  type="button"
                >
                  {visible[row.id] ? <EyeOff size={14} strokeWidth={2} /> : <Eye size={14} strokeWidth={2} />}
                </button>
              </div>
              {test && !test.testing && (
                <div className={`flex items-center gap-1 text-[10px] mt-1 ${test.success ? 'text-accent-green' : 'text-accent-red'}`}>
                  {test.success ? <Check size={11} strokeWidth={2} /> : <X size={11} strokeWidth={2} />}
                  {test.success
                    ? `Connected${test.durationMs !== undefined ? ` (${test.durationMs}ms)` : ''}`
                    : test.error || 'Failed'}
                </div>
              )}
            </div>
          );
        })}

        {/* LLM providers with their own credentials */}
        {llmRows.map((provider) => (
          <LlmProviderRow
            key={provider.id}
            provider={provider}
            isCustom={isCustomProvider(provider.id)}
            testState={llm.testStates[provider.id] as LlmProviderTestState | undefined}
            onUpdate={updateLlm}
            onTest={llm.testProvider}
            onRemove={(id) => {
              llm.removeProvider(id);
              setLlmDirty(true);
            }}
          />
        ))}

        {/* H5: V1 ships one engine path — the compat-endpoint form is
            dev-flagged (VITE_FF_CUSTOM_PROVIDER). Saved custom providers
            still render above; only NEW ones are gated. */}
        {isFeatureEnabled('custom-provider') && (
          <CustomProviderForm
            existingIds={llm.providers.map((p) => p.id)}
            onAdd={(config) => {
              llm.addProvider(config);
              setLlmDirty(true);
            }}
          />
        )}

        {/* Footer: default LLM + save */}
        <div className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-dim">Default LLM provider</span>
            <Select
              value={llm.activeProvider ?? ''}
              onChange={(next) => {
                llm.setActiveProvider(next || null);
                setLlmDirty(true);
              }}
              options={enabledLlmProviders.map((p) => ({ value: p.id, label: p.name }))}
              className="min-w-[160px]"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {savedFlash && <span className="text-[11px] text-accent-green">Saved ✓</span>}
            {(keysError || llm.saveError) && (
              <span className="text-[11px] text-accent-red">{keysError || llm.saveError}</span>
            )}
            <Button variant="primary" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
