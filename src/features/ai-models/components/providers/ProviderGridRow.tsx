import type { ReactNode } from 'react';

/**
 * The five columns every provider row shares: Provider · Powers · Status ·
 * detail (the key field, or a line of copy) · actions. Fixed status column,
 * flexible name / detail, so rows line up across the API-keys table and the
 * Subscriptions table on the same page.
 */
const GRID_COLS =
  'grid-cols-[minmax(150px,1.1fr)_minmax(120px,0.9fr)_112px_minmax(220px,2fr)_minmax(64px,auto)]';

interface ProviderGridRowProps {
  name: ReactNode;
  powers: ReactNode;
  status: ReactNode;
  detail: ReactNode;
  actions?: ReactNode;
  /** Second line under the columns: extra fields, test results, expanders. */
  below?: ReactNode;
  /** Dimmed row (a disabled provider). */
  muted?: boolean;
  /** `data-provider-row` hook for drivers and tests. */
  rowId: string;
}

export function ProviderGridRow({ name, powers, status, detail, actions, below, muted, rowId }: ProviderGridRowProps) {
  return (
    <div
      className={`px-3 py-2 ${muted ? 'opacity-60' : ''}`}
      style={{ borderBottom: '0.5px solid var(--color-border)' }}
      data-provider-row={rowId}
    >
      <div className={`grid ${GRID_COLS} items-center gap-x-3`}>
        <div className="flex min-w-0 items-center gap-2">{name}</div>
        <div className="flex flex-wrap items-center gap-1">{powers}</div>
        <div className="flex items-center">{status}</div>
        <div className="min-w-0">{detail}</div>
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div>
      {below && <div className="mt-1.5">{below}</div>}
    </div>
  );
}

interface ProviderGridHeaderProps {
  /** Caption of the detail column ("API key" on the keys table, "Details" on subscriptions). */
  detailLabel: string;
}

/** Column captions above a provider table. */
export function ProviderGridHeader({ detailLabel }: ProviderGridHeaderProps) {
  const caption = 'text-[9px] font-medium uppercase tracking-[0.06em] text-text-dim';
  return (
    <div className="px-3 py-1.5" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className={`grid ${GRID_COLS} items-center gap-x-3`}>
        <div className={caption}>Provider</div>
        <div className={caption}>Powers</div>
        <div className={caption}>Status</div>
        <div className={caption}>{detailLabel}</div>
        <div />
      </div>
    </div>
  );
}
