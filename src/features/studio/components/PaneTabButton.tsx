interface Props {
  label: string;
  /** Shown after the label, dimmer ("Media 113"); omitted when undefined. */
  count?: number;
  isActive: boolean;
  onClick: () => void;
  /** Test / CDP hook: `data-pane-tab="<id>"`. */
  tabId: string;
}

/** One tab of the editor's side panes (left: Media | Shots | Captions; right: Inspector | Script | Assistant). */
export function PaneTabButton({ label, count, isActive, onClick, tabId }: Props) {
  return (
    <button
      onClick={onClick}
      data-pane-tab={tabId}
      aria-pressed={isActive}
      className={`flex-1 min-w-0 px-1 text-[11px] truncate transition-colors ${
        isActive
          ? 'text-text-primary bg-app-surface'
          : 'text-text-muted hover:text-text-secondary hover:bg-app-hover'
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1 text-[10px] text-text-dim">{count}</span>}
    </button>
  );
}
