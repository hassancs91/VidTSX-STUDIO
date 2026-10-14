// The Creator panel's row of equal-width choice buttons (budget, FPS, aspect
// ratio, thinking) — one component, four uses.

interface Props<T extends string | number> {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** A dim line under the buttons, about the picked value. */
  hint?: string;
}

export function MotionSegmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled,
  className = '',
  hint,
}: Props<T>) {
  return (
    <div className={`px-3 pb-3 flex flex-col gap-1 ${className}`} data-motion-segment={label}>
      <label className="text-[10px] text-text-dim">{label}</label>
      <div className="flex rounded-[6px] overflow-hidden" style={{ border: '0.5px solid var(--color-border)' }}>
        {options.map((option, i) => (
          <button
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`flex-1 px-[6px] py-[4px] text-[10px] transition-colors duration-150 cursor-pointer ${
              value === option.value ? 'bg-accent text-white' : 'bg-app-base text-text-muted hover:bg-app-hover'
            }`}
            style={{ borderRight: i < options.length - 1 ? '0.5px solid var(--color-border)' : 'none' }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint && <span className="text-[9px] text-text-dim">{hint}</span>}
    </div>
  );
}
