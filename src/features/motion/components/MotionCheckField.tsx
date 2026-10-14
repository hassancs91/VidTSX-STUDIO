// One checkbox row of the Creator composer (Loop, Optimize): a label and a
// dim hint beside it.

interface Props {
  /** For `data-motion-check`, so a test drive can find the row. */
  name: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function MotionCheckField({ name, label, hint, checked, onChange, disabled }: Props) {
  return (
    <div className="px-3 pb-3">
      <label className="flex items-center gap-2 cursor-pointer" data-motion-check={name}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="accent-accent cursor-pointer"
        />
        <span className="text-[11px] text-text-muted">{label}</span>
        {hint && <span className="text-[9px] text-text-dim">{hint}</span>}
      </label>
    </div>
  );
}
