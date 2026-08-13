import { Panel, SectionHeader } from '@shared/components';
import { useProviderModels } from '@renderer/hooks/useProviderModels';
import { ModelCatalogCard } from './ModelCatalogCard';

/**
 * Editable model lists per provider. Seeded with shipped defaults; add/remove
 * models freely, reset any list back to defaults. Every model picker in the
 * app (Image Studio, testers) reads these lists through the image engine.
 */
export function ModelCatalogSection() {
  const { catalogs, loading, busy, error, save, reset } = useProviderModels();

  return (
    <div className="mt-6">
      <SectionHeader>Model Catalogs</SectionHeader>
      <div className="text-[10px] text-text-dim -mt-1 mb-3">
        The models each provider offers in pickers across the app. Add ids straight from the
        provider's site, remove ones you don't use, or reset to the shipped defaults.
      </div>

      {loading ? (
        <Panel className="p-3">
          <div className="text-[12px] text-text-muted">Loading model catalogs…</div>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {catalogs.map((catalog) => (
            <ModelCatalogCard
              key={`${catalog.providerId}:${catalog.category}`}
              catalog={catalog}
              busy={busy}
              onSave={(models) => save(catalog.providerId, catalog.category, models)}
              onReset={() => reset(catalog.providerId, catalog.category)}
            />
          ))}
        </div>
      )}

      {error && <div className="text-[11px] text-accent-red mt-2">{error}</div>}
    </div>
  );
}
