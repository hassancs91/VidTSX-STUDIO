import { useEffect, useState } from 'react';
import { Select } from '@shared/components/Select';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { filterUsableLlmProviders } from '@shared/services/llm-provider-filter';
import { THINKING_UI_OPTIONS } from '@shared/tsx-engine';
import type { ThinkingLevel } from '@shared/tsx-engine';
import { llmModelSupportsThinking } from '@shared/presets/llm-models';
import { ModelSelect } from '@renderer/components/ModelSelect';
import { useModelPicker } from '@renderer/hooks/useModelPicker';
import type { StudioAgentSettings } from '../types';
import { buildAgentProviderOptions } from '../services/provider-options';

interface Props {
  settings: StudioAgentSettings;
  onChange: (patch: Partial<StudioAgentSettings>) => void;
}

/**
 * Inspector → AI Assistant: the one cluster provider → planning model → shot
 * model → thinking (W1). Every value persists into the project's
 * `settings.agent`, so the composer chip in the Assistant tab and this
 * section always agree — they edit the same record.
 */
export function AgentSettingsSection({ settings, onChange }: Props) {
  const [providers, setProviders] = useState<LlmProviderConfig[]>([]);
  const picker = useModelPicker(settings.providerId);

  useEffect(() => {
    void window.api.llmProvidersGet().then((res) => {
      setProviders(filterUsableLlmProviders(res.providers));
    });
  }, []);

  const providerOptions = buildAgentProviderOptions(providers, settings.providerId);
  const showThinking = llmModelSupportsThinking(picker.providerId, settings.model);

  return (
    <section className="flex flex-col gap-2" data-agent-settings>
      <span className="text-[10px] uppercase tracking-wider text-text-muted">AI Assistant</span>
      <Field label="Provider">
        <Select
          value={settings.providerId ?? ''}
          onChange={(providerId) =>
            // A new provider has its own catalog — both model slots reset to
            // its default rather than carrying a foreign id across.
            onChange({ providerId: providerId || undefined, model: undefined, shotModel: undefined })
          }
          options={providerOptions}
        />
      </Field>
      <Field label="Planning model">
        <ModelSelect
          models={picker.models}
          defaultModel={picker.defaultModel}
          value={settings.model ?? ''}
          onChange={(model) => onChange({ model: model || undefined })}
        />
      </Field>
      <Field label="Shot model">
        <ModelSelect
          models={picker.models}
          defaultModel={settings.model || picker.defaultModel}
          value={settings.shotModel ?? ''}
          onChange={(shotModel) => onChange({ shotModel: shotModel || undefined })}
        />
      </Field>
      {showThinking && (
        <Field label="Thinking">
          <Select
            value={settings.thinking ?? 'off'}
            onChange={(level) =>
              onChange({ thinking: level === 'off' ? undefined : (level as ThinkingLevel) })
            }
            options={THINKING_UI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </Field>
      )}
      <p className="text-[10px] text-text-dim leading-snug">
        The planning model runs the chat and editorial passes; the shot model writes TSX shots
        (defaults to the planning model). Configure providers and model lists in the AI tab.
      </p>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-text-dim">{label}</span>
      {children}
    </label>
  );
}
