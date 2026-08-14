import type { CategoryFilter } from '../services/asset-search';

interface AssetSearchBarProps {
  query: string;
  onQuery: (value: string) => void;
  category: CategoryFilter;
  onCategory: (value: CategoryFilter) => void;
}

const CHIPS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
  { value: 'image', label: 'Image' },
  { value: 'other', label: 'Other' },
];

export function AssetSearchBar({ query, onQuery, category, onCategory }: AssetSearchBarProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onQuery('');
        }}
        placeholder="Search name or description…"
        className="h-[28px] w-[240px] px-2 rounded bg-app-surface text-text-primary text-[12px] focus:outline-none"
        style={{ border: '0.5px solid var(--color-border-input)' }}
      />
      <div className="flex items-center gap-1">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onCategory(chip.value)}
            className={`px-2 py-1 rounded text-[11px] transition-colors ${
              category === chip.value
                ? 'bg-accent text-white'
                : 'bg-app-surface text-text-secondary hover:bg-app-hover'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
