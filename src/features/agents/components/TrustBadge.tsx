// The one trust tag a card or dialog shows (agents plan §1.7).

import type { TrustTag } from '../types';

const TONE: Record<TrustTag['tone'], { color: string; background: string }> = {
  accent: { color: 'var(--color-accent-light)', background: 'rgba(127, 119, 221, 0.16)' },
  warning: { color: 'var(--color-accent-amber)', background: 'rgba(239, 159, 39, 0.14)' },
  neutral: { color: 'var(--color-text-muted)', background: 'var(--color-app-hover)' },
};

export function TrustBadge({ tag, title }: { tag: TrustTag; title?: string }) {
  return (
    <span
      title={title ?? tag.notice ?? tag.label}
      className="inline-block rounded-[4px] px-[5px] py-[1px] text-[9px] whitespace-nowrap"
      style={TONE[tag.tone]}
    >
      {tag.label}
    </span>
  );
}
