import { useMemo, useState } from 'react';
import { Panel } from '@shared/components';
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
import { groupCatalogsByProvider } from '../../services/catalog-groups';
import { ModelParamsDialog } from '../ModelParamsDialog';
import { ProviderCatalogRow } from './ProviderCatalogRow';

interface ParamsTarget {
  providerId: string;
  model: ImageModelCatalogEntry;
  dialect: ImageDialectId;
}

interface ModelCatalogSectionProps {
  /** Providers with a key / sign-in — listed first; the rest sit under a caption. */
  configuredIds: Set<string>;
}

/**
 * Editable model lists per provider, as an accordion of providers (redesign
 * §3.2): each row is collapsed to "Fal — 12 image · 4 video models —
 * Defaults" and opens to the same add / remove / dialect / gear controls as
 * before. Every model picker in the app reads these lists through the
 * engines; every save re-registers the category's providers immediately.
 */
export function ModelCatalogSection({ configuredIds }: ModelCatalogSectionProps) {
  const { catalogs, loading, busy, error, save, reset } = useProviderModels();
  const params = useImageModelParams();
  const [target, setTarget] = useState<ParamsTarget | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const grouped = useMemo(() => groupCatalogsByProvider(catalogs, configuredIds), [catalogs, configuredIds]);

  const toggle = (providerId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });

  const openParams = (providerId: string, model: ImageModelCatalogEntry) => {
    const named = typeof model.dialect === 'string' ? model.dialect : '';
    const dialect: ImageDialectId = isImageDialectId(named) ? named : (DEFAULT_IMAGE_DIALECT[providerId] ?? 'fal-generic');
    setTarget({ providerId, model, dialect });
  };

  const rowProps = {
    busy,
    onSave: save,
    onReset: reset,
    onParams: openParams,
    hasParams: (providerId: string, modelId: string) => hasAnyImageParams(params.get(providerId, modelId)),
  };

  return (
    <div>
      <div className="mb-3 text-[10px] text-text-dim">
        The models each provider offers in pickers across the app. Open a provider to add ids straight from its site,
        remove ones you don’t use, or reset to the shipped defaults. The gear on an image model sets its default
        parameters (steps, guidance, seed…).
      </div>

      {loading ? (
        <Panel className="p-3">
          <div className="text-[12px] text-text-muted">Loading model catalogs…</div>
        </Panel>
      ) : (
        <>
          {grouped.configured.length > 0 && (
            <Panel>
              {grouped.configured.map((group) => (
                <ProviderCatalogRow key={group.providerId} group={group} open={open.has(group.providerId)} onToggle={() => toggle(group.providerId)} {...rowProps} />
              ))}
            </Panel>
          )}
          {grouped.unconfigured.length > 0 && (
            <>
              <div className={`${grouped.configured.length > 0 ? 'mt-4' : ''} mb-2 text-[9px] font-medium uppercase tracking-[0.06em] text-text-dim`}>
                Providers without a key
              </div>
              <Panel>
                {grouped.unconfigured.map((group) => (
                  <ProviderCatalogRow key={group.providerId} group={group} open={open.has(group.providerId)} onToggle={() => toggle(group.providerId)} {...rowProps} />
                ))}
              </Panel>
            </>
          )}
        </>
      )}

      {error && <div className="mt-2 text-[11px] text-accent-red">{error}</div>}
      {params.error && <div className="mt-2 text-[11px] text-accent-red">{params.error}</div>}

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
