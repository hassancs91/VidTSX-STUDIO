import { useState } from 'react';
import type { LlmModelCatalogEntry } from '../../shared/presets/llm-models';
import {
  buildLlmModelOptions,
  CUSTOM_MODEL_OPTION,
  isCustomLlmModel,
} from '../../shared/services/llm-model-options';

interface ModelSelectProps {
  /** The provider's llm catalog (from useModelPicker). */
  models: LlmModelCatalogEntry[];
  /** What '' means for this provider — shown in the first row's label. */
  defaultModel?: string | undefined;
  /** '' = provider default; any other string is sent as the model id. */
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}

const SELECT_CLASS =
  'bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer w-full';

/**
 * The app-wide model dropdown, beside ProviderSelect: provider default, the
 * catalog, and "Custom…" which opens a free-text id box (the Flows picker
 * precedent — any id the provider accepts is allowed everywhere).
 */
export function ModelSelect({ models, defaultModel, value, onChange, disabled }: ModelSelectProps) {
  const [customMode, setCustomMode] = useState(false);
  const custom = customMode || isCustomLlmModel(models, value);
  const options = buildLlmModelOptions(models, defaultModel, value);

  return (
    <div className="flex flex-col gap-1">
      <select
        className={SELECT_CLASS}
        value={custom ? CUSTOM_MODEL_OPTION : value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value;
          if (next === CUSTOM_MODEL_OPTION) {
            setCustomMode(true);
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      >
        {options
          .filter((o) => !(custom && o.value === value && o.value !== CUSTOM_MODEL_OPTION))
          .map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
      </select>
      {custom && (
        <input
          type="text"
          autoFocus={customMode}
          value={value}
          disabled={disabled}
          placeholder="Model id, exactly as the provider names it"
          onChange={(e) => onChange(e.target.value.trim())}
          className="bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-primary outline-none focus:border-accent w-full font-mono"
          data-testid="model-select-custom"
        />
      )}
    </div>
  );
}
