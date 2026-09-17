import { Panel } from '@shared/components';
import { Select } from '@shared/components/Select';
import type { LlmProvidersApi } from '../../hooks/useProviderKeyDrafts';

interface ProviderDefaultsBarProps {
  llm: LlmProvidersApi;
  onActiveChange: (id: string | null) => void;
}

/**
 * App-wide defaults. Today: the LLM provider used wherever nothing more
 * specific was chosen (the TSX creator, a Studio project without its own
 * provider). Only enabled providers are offered; the hidden `local` preset
 * never reaches this list (llm-preset-visibility, main process).
 */
export function ProviderDefaultsBar({ llm, onActiveChange }: ProviderDefaultsBarProps) {
  const enabled = llm.providers.filter((p) => p.enabled);
  return (
    <Panel className="p-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="text-[11px] text-text-secondary">Default LLM provider</span>
          <Select
            value={llm.activeProvider ?? ''}
            onChange={(next) => onActiveChange(next || null)}
            options={enabled.map((p) => ({ value: p.id, label: p.name }))}
            className="min-w-[200px]"
          />
        </label>
        <span className="text-[10px] text-text-dim">
          Used by the TSX creator and by any project or agent that has no provider of its own.
        </span>
      </div>
    </Panel>
  );
}
