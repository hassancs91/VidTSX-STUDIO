import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Panel } from '@shared/components';

interface LocalSectionPanelProps {
  /** `data-local-section` hook for drivers and tests (installed · recommended · all · defaults). */
  id: string;
  title: string;
  /** Count after the title ("Installed 3"). */
  count?: number;
  /** Right side of the header (a search field, a caption). */
  aside?: ReactNode;
  /** One line under the header explaining the list. */
  caption?: ReactNode;
  /** Shown centred instead of the rows. */
  isEmpty?: boolean;
  empty?: ReactNode;
  /** Present → the header toggles the body (the "All models" disclosure). */
  expanded?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}

/**
 * One panel of the local-model page template (docs/ai-models-redesign.md
 * §3.3): the UI_SPEC panel header row (32 px, 11 px muted title) with an
 * optional count, caption line, empty state and a disclosure variant.
 */
export function LocalSectionPanel({
  id,
  title,
  count,
  aside,
  caption,
  isEmpty,
  empty,
  expanded,
  onToggle,
  children,
}: LocalSectionPanelProps) {
  const collapsible = onToggle !== undefined;
  const open = !collapsible || Boolean(expanded);
  const heading = (
    <span className="text-[11px] font-medium text-text-muted">
      {title}
      {count !== undefined && <span className="ml-1.5 font-normal text-text-dim">{count}</span>}
    </span>
  );

  return (
    <Panel>
      <div
        className="flex h-[32px] items-center justify-between gap-3 px-3"
        style={open ? { borderBottom: '0.5px solid var(--color-border)' } : undefined}
        data-local-section={id}
        data-expanded={collapsible ? String(open) : undefined}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-text-muted transition-colors duration-150 hover:text-text-secondary"
          >
            {open ? <ChevronDown size={12} strokeWidth={1.5} /> : <ChevronRight size={12} strokeWidth={1.5} />}
            {heading}
          </button>
        ) : (
          heading
        )}
        {aside && <div className="flex shrink-0 items-center gap-2">{aside}</div>}
      </div>

      {open && caption && (
        <div className="px-3 py-1.5 text-[10px] text-text-dim" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          {caption}
        </div>
      )}

      {open && (isEmpty ? <div className="p-4 text-center text-[12px] text-text-muted">{empty}</div> : children)}
    </Panel>
  );
}
