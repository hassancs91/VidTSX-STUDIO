import type { LlmProviderConfig } from '../../shared/ipc/types';

interface ProviderSelectProps {
  providers: LlmProviderConfig[];
  value: string;
  onChange: (providerId: string) => void;
  disabled?: boolean;
}

/** The app-wide provider dropdown. Pair with useProviderPicker, which
 *  supplies the usable-provider list and selection fallback logic. */
export function ProviderSelect({ providers, value, onChange, disabled }: ProviderSelectProps) {
  return (
    <select
      className="bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer w-full"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {providers.length === 0 ? (
        <option value="">No providers configured</option>
      ) : (
        providers.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))
      )}
    </select>
  );
}
