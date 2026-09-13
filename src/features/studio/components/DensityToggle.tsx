import { LayoutGrid, List } from 'lucide-react';

export type PoolDensity = 'grid' | 'list';
export const POOL_DENSITIES: readonly PoolDensity[] = ['grid', 'list'];

interface Props {
  value: PoolDensity;
  onChange: (next: PoolDensity) => void;
}

/** Grid (compact tiles) / list (the roomy card, for long file names) — video-10 feedback item 5. */
export function DensityToggle({ value, onChange }: Props) {
  const button = (density: PoolDensity, title: string, Icon: typeof List) => (
    <button
      type="button"
      onClick={() => onChange(density)}
      data-density={density}
      aria-pressed={value === density}
      title={title}
      className={`flex items-center justify-center w-[22px] h-[20px] rounded-[4px] transition-colors ${
        value === density ? 'bg-app-active text-text-primary' : 'text-text-muted hover:bg-app-hover hover:text-text-secondary'
      }`}
    >
      <Icon size={12} strokeWidth={1.5} />
    </button>
  );
  return (
    <div className="flex items-center gap-px" data-density-toggle>
      {button('grid', 'Grid: small tiles', LayoutGrid)}
      {button('list', 'List: large cards with full details', List)}
    </div>
  );
}
