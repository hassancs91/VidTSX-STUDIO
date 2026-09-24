import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  /** Shown after the label, dimmer ("Media 113"); omitted when undefined. */
  count?: number;
  isActive: boolean;
  onClick: () => void;
  /** Test / CDP hook: `data-pane-tab="<id>"`. */
  tabId: string;
  /**
   * With an icon the tab survives a crowded row: the active tab takes its
   * natural width so its label never truncates, and when the row (an
   * `@container`) is narrower than 400 px the inactive tabs show only the icon
   * (and count). The label is always the tooltip.
   */
  icon?: LucideIcon;
}

/** One tab of the editor's side panes (left: Media | Shots | Captions | …; right: Inspector | Script | Assistant). */
export function PaneTabButton({ label, count, isActive, onClick, tabId, icon: Icon }: Props) {
  return (
    <button
      onClick={onClick}
      data-pane-tab={tabId}
      aria-pressed={isActive}
      title={label}
      className={`${Icon && isActive ? 'flex-none px-2' : 'flex-1 min-w-0 px-1'} overflow-hidden flex items-center justify-center gap-1 text-[11px] transition-colors ${
        isActive
          ? 'text-text-primary bg-app-surface'
          : 'text-text-muted hover:text-text-secondary hover:bg-app-hover'
      }`}
    >
      {Icon && (
        <Icon size={12} strokeWidth={1.5} className={`shrink-0 ${isActive ? 'text-accent-light' : ''}`} aria-hidden />
      )}
      <span className={`min-w-0 truncate ${Icon && !isActive ? '@max-[400px]:sr-only' : ''}`}>{label}</span>
      {count !== undefined && <span className="shrink-0 text-[10px] text-text-dim">{count}</span>}
    </button>
  );
}
