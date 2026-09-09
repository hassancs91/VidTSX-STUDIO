import { Palette } from 'lucide-react';
import { Select } from '@shared/components/Select';
import type { AgentBrandOption } from '../hooks/useAgentBrandList';

interface Props {
  brands: AgentBrandOption[];
  /** null = no brand. */
  brandId: string | null;
  onChange: (brandId: string | null) => void;
  disabled?: boolean;
  /** Compact chip form for the chat header. */
  compact?: boolean;
}

const NONE = '';

/** The session brand picker (W4): one select, "No brand" first, then every
 *  library brand. Used by the starter (before the session exists) and by
 *  the chat header (patches the open session). */
export function BrandSelect({ brands, brandId, onChange, disabled, compact }: Props) {
  const options = [
    { value: NONE, label: 'No brand' },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
  ];
  // A stale id (brand deleted) still renders as a row so the user sees it.
  if (brandId && !brands.some((b) => b.id === brandId)) {
    options.push({ value: brandId, label: `${brandId} (missing)` });
  }
  return (
    <div className={`flex items-center gap-1 ${compact ? 'max-w-[170px]' : 'w-full'}`} data-brand-select>
      <Palette size={11} strokeWidth={1.75} className="shrink-0 text-text-muted" />
      <Select
        value={brandId ?? NONE}
        onChange={(value) => onChange(value === NONE ? null : value)}
        options={options}
        disabled={disabled}
        className="flex-1 min-w-0"
      />
    </div>
  );
}
