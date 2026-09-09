import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Cpu } from 'lucide-react';
import type { LlmProviderConfig } from '../../shared/ipc/types';
import type { ThinkingLevel } from '../../shared/tsx-engine/types';
import { THINKING_UI_OPTIONS } from '../../shared/tsx-engine/thinking-config';
import { llmModelDisplayName, llmModelSupportsThinking } from '../../shared/presets/llm-models';
import { useModelPicker } from '../hooks/useModelPicker';
import { ModelSelect } from './ModelSelect';
import { ProviderSelect } from './ProviderSelect';

interface ModelPickerChipProps {
  providers: LlmProviderConfig[];
  /** '' is allowed only with `appDefaultLabel` (Studio's "app default"). */
  providerId: string;
  onProviderChange: (providerId: string) => void;
  /** '' = the provider's default model. */
  model: string;
  onModelChange: (model: string) => void;
  /** Omit both to hide the thinking dial (Agents sessions). */
  thinking?: ThinkingLevel;
  onThinkingChange?: (level: ThinkingLevel) => void;
  /** When set, the provider list gains a '' row with this label. */
  appDefaultLabel?: string;
  disabled?: boolean;
}

/**
 * The composer chip ("Fable · Deep") both chats share. Click opens the one
 * cluster — provider → model → thinking — as a popover above the chip; the
 * choice applies to the next turn and sticks (the caller persists it).
 */
export function ModelPickerChip({
  providers,
  providerId,
  onProviderChange,
  model,
  onModelChange,
  thinking,
  onThinkingChange,
  appDefaultLabel,
  disabled,
}: ModelPickerChipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const picker = useModelPicker(providerId);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const providerName = providerId
    ? (providers.find((p) => p.id === providerId)?.name ?? providerId)
    : (appDefaultLabel ?? 'Default');
  const modelName = llmModelDisplayName(picker.providerId, model || undefined);
  const showThinking =
    onThinkingChange !== undefined && llmModelSupportsThinking(picker.providerId, model || undefined);
  const thinkingLabel = THINKING_UI_OPTIONS.find((o) => o.value === thinking)?.label;
  const label = [providerName, modelName, showThinking && thinking && thinking !== 'off' ? thinkingLabel : null]
    .filter(Boolean)
    .join(' · ');

  const providerOptions = appDefaultLabel
    ? [{ id: '', name: appDefaultLabel } as LlmProviderConfig, ...providers]
    : providers;

  return (
    <div ref={rootRef} className="relative min-w-0" data-model-picker-chip>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Provider, model and thinking for the next turn"
        className="flex items-center gap-1 max-w-[220px] h-[20px] rounded-[10px] bg-app-active px-2 text-[10px] text-text-muted hover:text-text-secondary hover:bg-app-hover disabled:opacity-40"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <Cpu size={10} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronUp size={10} strokeWidth={1.75} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute bottom-[24px] left-0 z-30 w-[260px] flex flex-col gap-2 rounded-[8px] bg-app-surface p-2.5 shadow-lg"
          style={{ border: '0.5px solid var(--color-border)' }}
          data-model-picker-popover
        >
          <Field label="Provider">
            <ProviderSelect
              providers={providerOptions}
              value={providerId}
              onChange={(next) => {
                onProviderChange(next);
                onModelChange('');
              }}
            />
          </Field>
          <Field label="Model">
            <ModelSelect
              models={picker.models}
              defaultModel={picker.defaultModel}
              value={model}
              onChange={onModelChange}
            />
          </Field>
          {showThinking && (
            <Field label="Thinking">
              <div className="flex rounded-[6px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
                {THINKING_UI_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => onThinkingChange?.(o.value)}
                    className={`flex-1 px-[6px] py-[4px] text-[10px] transition-colors ${
                      (thinking ?? 'off') === o.value
                        ? 'bg-app-active text-text-primary'
                        : 'text-text-dim hover:text-text-secondary hover:bg-app-hover'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
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
