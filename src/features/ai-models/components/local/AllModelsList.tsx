import { useMemo, useState, type ReactNode } from 'react';
import { TextInput } from '@shared/components';
import type { ModelDownloadStatus } from '../../hooks/useImageLibrary';
import { filterCatalog } from '../../services/catalog-sections';
import type { CatalogRowData } from '../../types';
import { CatalogModelRow, type CatalogRowActions } from './CatalogModelRow';
import { LocalSectionPanel } from './LocalSectionPanel';

interface AllModelsListProps extends CatalogRowActions {
  /** Every uninstalled entry, the recommended ones included (catalog order). */
  rows: CatalogRowData[];
  downloads: Record<string, ModelDownloadStatus>;
  caption?: ReactNode;
}

/**
 * The "All models" panel of the local-model template: collapsed by default
 * (a count in the header says what is behind it), a search field when open,
 * the full catalog including link-only entries.
 */
export function AllModelsList({ rows, downloads, caption, ...actions }: AllModelsListProps) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => filterCatalog(rows, search), [rows, search]);

  return (
    <LocalSectionPanel
      id="all"
      title="All models"
      count={rows.length}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      aside={
        expanded ? (
          <TextInput
            type="text"
            placeholder="Search…"
            aria-label="Search all models"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[180px]"
          />
        ) : undefined
      }
      caption={
        caption ?? 'One-click download fetches the model and every file it needs. Link-only entries open the model page.'
      }
      isEmpty={filtered.length === 0}
      empty={search.trim() ? 'No matches' : 'Every catalog model is installed'}
    >
      {filtered.map((row) => (
        <CatalogModelRow key={row.id} row={row} download={downloads[row.id]} {...actions} />
      ))}
    </LocalSectionPanel>
  );
}
