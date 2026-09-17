interface EnabledToggleProps {
  on: boolean;
  onToggle: () => void;
  /** Show the "On" / "Off" word beside the switch (default true). */
  showLabel?: boolean;
  title?: string;
}

/** The small On / Off switch every provider row uses (UI_SPEC accent on, hover-grey off). */
export function EnabledToggle({ on, onToggle, showLabel = true, title }: EnabledToggleProps) {
  return (
    <span className="flex shrink-0 select-none items-center gap-1.5" title={title}>
      {showLabel && <span className="text-[10px] text-text-dim">{on ? 'On' : 'Off'}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={`relative h-[16px] w-[32px] cursor-pointer rounded-full transition-colors duration-150 ${on ? 'bg-accent' : 'bg-app-hover'}`}
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <span
          className={`absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all duration-150 ${on ? 'left-[18px]' : 'left-[3px]'}`}
        />
      </button>
    </span>
  );
}
