// The states every viewer shares: still resolving, failed, or nothing to show.
// Pulled out so five viewers do not each grow their own spinner and their own
// slightly different error copy.

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  loading?: boolean;
  error?: string;
  /** Shown when there is no error but nothing arrived either. */
  emptyLabel?: string;
  ready: boolean;
  children: ReactNode;
}

export function ViewerFrame({ loading, error, emptyLabel, ready, children }: Props) {
  if (error) {
    return (
      <Centered>
        <AlertTriangle size={20} strokeWidth={1.5} className="text-accent-red" />
        <div className="text-[11px] text-text-muted max-w-[320px] leading-snug">{error}</div>
      </Centered>
    );
  }
  if (loading && !ready) {
    return (
      <Centered>
        <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <div className="text-[11px] text-text-dim">Opening…</div>
      </Centered>
    );
  }
  if (!ready) {
    return (
      <Centered>
        <div className="text-[11px] text-text-dim">{emptyLabel ?? 'Nothing to show yet.'}</div>
      </Centered>
    );
  }
  return <>{children}</>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full w-full text-center px-4">
      {children}
    </div>
  );
}
