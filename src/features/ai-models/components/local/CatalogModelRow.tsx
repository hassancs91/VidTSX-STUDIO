import { StatusBadge } from '@shared/components';
import type { ModelDownloadStatus } from '../../hooks/useImageLibrary';
import type { CatalogRowData } from '../../types';
import { DownloadCell } from '../DownloadCell';
import { FamilyBadge } from '../FamilyBadge';
import { FitBadge } from '../FitBadge';
import { TierChip } from './TierChip';

/** The download actions every catalog list threads through to its rows. */
export interface CatalogRowActions {
  onDownload: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onOpenExternal?: (url: string) => void;
}

interface CatalogModelRowProps extends CatalogRowActions {
  row: CatalogRowData;
  download?: ModelDownloadStatus;
}

/**
 * One uninstalled catalog entry on the Recommended and All lists: name ·
 * family · tier chip · Fits badge · Tested chip, the size under it, and
 * Download (or Get ↗ for link-only entries) on the right — a download in
 * flight replaces the actions with the shared progress cell.
 */
export function CatalogModelRow({ row, download, onDownload, onPause, onResume, onCancel, onOpenExternal }: CatalogModelRowProps) {
  const sourceUrl = row.sourceUrl;
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0" data-catalog-row={row.id}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[12px] text-text-secondary">{row.name}</span>
          <FamilyBadge family={row.family} />
          <TierChip tier={row.tier} />
          <FitBadge fit={row.fit} />
          {row.verifiedOn && (
            <StatusBadge tone="success" title={`Generated real output during the release pass of ${row.verifiedOn}`}>
              Tested
            </StatusBadge>
          )}
        </div>
        <div className="truncate text-[9px] text-text-dim">
          {row.sizeLabel}
          {row.hint ? ` · ${row.hint}` : ''}
        </div>
      </div>

      {download ? (
        <DownloadCell
          status={download}
          onPause={() => onPause(row.id)}
          onResume={() => onResume(row.id)}
          onCancel={() => onCancel(row.id)}
        />
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          {sourceUrl && onOpenExternal && (
            <button
              type="button"
              onClick={() => onOpenExternal(sourceUrl)}
              className={`h-[24px] rounded px-2 text-[10px] font-medium hover:bg-app-hover ${
                row.hasDownload ? 'text-text-muted hover:text-accent-light' : 'text-accent-light'
              }`}
              title={row.hasDownload ? sourceUrl : 'Opens the model page — download the file there, then Import it'}
            >
              Get ↗
            </button>
          )}
          {row.hasDownload && (
            <button
              type="button"
              onClick={() => onDownload(row.id)}
              className="h-[24px] rounded px-2 text-[10px] font-medium text-accent-light hover:bg-app-hover"
            >
              Download
            </button>
          )}
        </div>
      )}
    </div>
  );
}
