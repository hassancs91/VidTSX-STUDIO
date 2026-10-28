import { chipLabel, type CategoryFilter, type ChipFilter } from '../services/asset-search';

interface AssetSearchBarProps {
  query: string;
  onQuery: (value: string) => void;
  category: CategoryFilter;
  onCategory: (value: CategoryFilter) => void;
  /** The chip filter set from the details panel (E3) — shown as a removable pill. */
  chip: ChipFilter | null;
  onClearChip: () => void;
}

const CHIPS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Image' },
  { value: 'other', label: 'Other' },
];

export function AssetSearchBar({ query, onQuery, category, onCategory, chip, onClearChip }: AssetSearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onQuery('');
        }}
        placeholder="Search name, description or tag…"
        className="h-[28px] w-[240px] px-2 rounded bg-app-surface text-text-primary text-[12px] focus:outline-none"
        style={{ border: '0.5px solid var(--color-border-input)' }}
      />
      <div className="flex items-center gap-1">
        {CHIPS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onCategory(option.value)}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              category === option.value
                ? 'bg-accent text-white'
                : 'bg-app-surface text-text-secondary hover:bg-app-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {chip && (
        <button
          type="button"
          onClick={onClearChip}
          title="Clear this filter"
          data-chip-filter
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-accent text-white hover:opacity-90"
        >
          {chipLabel(chip)}
          <span aria-hidden>×</span>
        </button>
      )}
    </div>
  );
}
