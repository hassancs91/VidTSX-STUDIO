import type { ReactNode } from 'react';
import type { ModelDownloadStatus } from '../../hooks/useImageLibrary';
import type { CatalogRowData } from '../../types';
import { CatalogModelRow, type CatalogRowActions } from './CatalogModelRow';
import { LocalSectionPanel } from './LocalSectionPanel';

interface RecommendedModelsListProps extends CatalogRowActions {
  /** The curated, uninstalled picks (splitCatalogSections().recommended, mapped to rows). */
  rows: CatalogRowData[];
  downloads: Record<string, ModelDownloadStatus>;
  caption?: ReactNode;
  /** The line shown once every pick is installed. */
  emptyLabel?: string;
}

/** The "Recommended" panel of the local-model template: the short list, laptop tier first. */
export function RecommendedModelsList({ rows, downloads, caption, emptyLabel, ...actions }: RecommendedModelsListProps) {
  return (
    <LocalSectionPanel
      id="recommended"
      title="Recommended"
      count={rows.length}
      caption={caption}
      isEmpty={rows.length === 0}
      empty={emptyLabel ?? 'Every recommended model is installed — the rest are under All models.'}
    >
      {rows.map((row) => (
        <CatalogModelRow key={row.id} row={row} download={downloads[row.id]} {...actions} />
      ))}
    </LocalSectionPanel>
  );
}
