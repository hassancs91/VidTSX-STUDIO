import { useState } from 'react';
import { Panel, SectionHeader } from '@shared/components';
import { useProviderModels } from '@renderer/hooks/useProviderModels';
import { useImageModelParams } from '@renderer/hooks/useImageModelParams';
import type { ImageModelCatalogEntry } from '@shared/presets/image-models';
import {
  DEFAULT_IMAGE_DIALECT,
  IMAGE_DIALECT_DEFAULTS,
  IMAGE_DIALECT_LABELS,
  isImageDialectId,
  type ImageDialectId,
} from '@shared/presets/image-dialects';
import { hasAnyImageParams } from '@shared/presets/image-model-params';
import { ModelCatalogCard } from './ModelCatalogCard';
import { ModelParamsDialog } from '../ModelParamsDialog';

interface ParamsTarget {
  providerId: string;
  model: ImageModelCatalogEntry;
  dialect: ImageDialectId;
}

/**
 * Editable model lists per provider. Seeded with shipped defaults; add/remove
 * models freely, reset any list back to defaults. Every model picker in the
 * app (Image Studio, testers) reads these lists through the image engine.
 * Image rows carry a gear that opens the per-model parameters dialog; the
 * fields it shows come from the row's dialect (image-dialects.ts).
 */
export function ModelCatalogSection() {
  const { catalogs, loading, busy, error, save, reset } = useProviderModels();
  const params = useImageModelParams();
  const [target, setTarget] = useState<ParamsTarget | null>(null);

  const openParams = (providerId: string, model: ImageModelCatalogEntry) => {
    const named = typeof model.dialect === 'string' ? model.dialect : '';
    const dialect: ImageDialectId = isImageDialectId(named)
      ? named
      : (DEFAULT_IMAGE_DIALECT[providerId] ?? 'fal-generic');
    setTarget({ providerId, model, dialect });
  };

  return (
    <div className="mt-6">
      <SectionHeader>Model Catalogs</SectionHeader>
      <div className="text-[10px] text-text-dim -mt-1 mb-3">
        The models each provider offers in pickers across the app. Add ids straight from the
        provider's site, remove ones you don't use, or reset to the shipped defaults. The gear on an
        image model sets its default parameters (steps, guidance, seed…).
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
              onParams={catalog.category === 'image' ? (model) => openParams(catalog.providerId, model) : undefined}
              hasParams={(modelId) => hasAnyImageParams(params.get(catalog.providerId, modelId))}
            />
          ))}
        </div>
      )}

      {error && <div className="text-[11px] text-accent-red mt-2">{error}</div>}
      {params.error && <div className="text-[11px] text-accent-red mt-2">{params.error}</div>}

      {target && (
        <ModelParamsDialog
          title={target.model.name}
          subtitle={`${target.providerId} · ${IMAGE_DIALECT_LABELS[target.dialect]} · ${target.model.id}`}
          schema={IMAGE_DIALECT_DEFAULTS[target.dialect].paramSchema}
          initial={params.get(target.providerId, target.model.id)}
          busy={params.busy}
          onSave={async (next) => {
            const ok = await params.save(target.providerId, target.model.id, next);
            if (ok) setTarget(null);
            return ok;
          }}
          onCancel={() => setTarget(null)}
        />
      )}
    </div>
  );
}
