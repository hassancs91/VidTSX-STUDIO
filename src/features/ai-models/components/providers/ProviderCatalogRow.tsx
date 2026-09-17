import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@shared/components';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import type { ProviderModelCatalogEntry } from '@shared/presets/provider-model-defaults';
import type { ProviderCatalogGroup } from '../../services/catalog-groups';
import { ModelCatalogCard } from './ModelCatalogCard';

interface ProviderCatalogRowProps {
  group: ProviderCatalogGroup;
  open: boolean;
  onToggle: () => void;
  busy: boolean;
  onSave: (providerId: string, category: ProviderCatalogGroup['catalogs'][number]['category'], models: ProviderModelCatalogEntry[]) => Promise<boolean>;
  onReset: (providerId: string, category: ProviderCatalogGroup['catalogs'][number]['category']) => Promise<boolean>;
  onParams: (providerId: string, model: ImageModelCatalogEntry) => void;
  hasParams: (providerId: string, modelId: string) => boolean;
}

/**
 * One provider in the Model catalogs accordion: a summary line that opens to
 * the editable lists (one card per category, the existing ModelCatalogCard).
 * Collapsed by default so the page reads as a list of providers, not a wall
 * of model ids.
 */
export function ProviderCatalogRow({ group, open, onToggle, busy, onSave, onReset, onParams, hasParams }: ProviderCatalogRowProps) {
  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border)' }} data-catalog-provider={group.providerId}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-[36px] w-full items-center gap-2 px-3 text-left transition-colors hover:bg-app-hover"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`shrink-0 text-text-dim transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
        />
        <span className="text-[12px] font-medium text-text-secondary">{group.label}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-text-dim">{group.summary}</span>
        <StatusBadge tone={group.customized ? 'accent' : 'neutral'}>{group.customized ? 'Customized' : 'Defaults'}</StatusBadge>
      </button>
      {open && (
        <div
          className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3 bg-app-base px-3 py-3"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          {group.catalogs.map((catalog) => (
            <ModelCatalogCard
              key={`${catalog.providerId}:${catalog.category}`}
              catalog={catalog}
              busy={busy}
              onSave={(models) => onSave(catalog.providerId, catalog.category, models)}
              onReset={() => onReset(catalog.providerId, catalog.category)}
              onParams={catalog.category === 'image' ? (model) => onParams(catalog.providerId, model) : undefined}
              hasParams={(modelId) => hasParams(catalog.providerId, modelId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
