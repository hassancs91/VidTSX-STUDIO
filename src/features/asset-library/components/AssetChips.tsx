import type { LibraryIndexEntry } from '@shared/types/asset-library';
import { chipLabel, chipsOf, sameChip, type ChipFilter } from '../services/asset-search';

interface AssetChipsProps {
  meta: Pick<LibraryIndexEntry, 'origin' | 'tags'>;
  /** The screen's chip filter — the matching chip shows as selected. */
  active: ChipFilter | null;
  /** A click sets the filter; clicking the selected chip clears it. */
  onChip: (chip: ChipFilter | null) => void;
}

/**
 * The origin chip + tag chips in the details panel (E3). Clicking one filters
 * the grid to the assets that share it (the pill by the search bar removes it).
 */
export function AssetChips({ meta, active, onChip }: AssetChipsProps) {
  return (
    <div className="flex flex-wrap gap-1" data-asset-chips>
      {chipsOf(meta).map((chip) => {
        const selected = sameChip(chip, active);
        const isOrigin = 'origin' in chip;
        return (
          <button
            key={chipLabel(chip)}
            type="button"
            onClick={() => onChip(selected ? null : chip)}
            title={selected ? 'Clear this filter' : `Show only ${chipLabel(chip).toLowerCase()}`}
            data-chip={isOrigin ? `origin:${chip.origin}` : `tag:${chip.tag}`}
            className={`px-1.5 py-px rounded text-[10px] transition-colors ${
              selected
                ? 'bg-accent text-white'
                : isOrigin
                  ? 'text-accent-light hover:bg-app-hover'
                  : 'bg-app-surface text-text-secondary hover:bg-app-hover'
            }`}
            style={isOrigin && !selected ? { border: '0.5px solid var(--color-border-hover)' } : undefined}
          >
            {isOrigin ? chip.origin : chip.tag}
          </button>
        );
      })}
    </div>
  );
}
