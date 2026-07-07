// Form field primitives used by every style's ConfigPanel. Kept here so each
// template file doesn't redeclare them — and so the look-and-feel stays
// consistent across styles.

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-[8px]">
      <span className="text-text-muted text-[10px]">{label}</span>
      <span className="flex items-center gap-[6px]">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-[24px] h-[18px] cursor-pointer rounded-[3px] border-0 p-0 bg-transparent"
        />
        <span className="text-text-dim text-[10px] font-mono uppercase">{value}</span>
      </span>
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  helper,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  helper?: string;
}) {
  return (
    <label className="flex flex-col gap-[3px]">
      <div className="flex items-center justify-between">
        <span className="text-text-muted text-[10px]">{label}</span>
        <span className="text-text-dim text-[10px]">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--color-accent)' }}
      />
      {helper && <span className="text-text-ghost text-[9px]">{helper}</span>}
    </label>
  );
}

export function SelectField<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (next: V) => void;
}) {
  return (
    <label className="flex flex-col gap-[3px]">
      <span className="text-text-muted text-[10px]">{label}</span>
      <div className="flex gap-[4px]">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex-1 h-[24px] rounded-[4px] text-[10px] font-medium transition-colors"
              style={{
                backgroundColor: active ? 'var(--color-accent)' : 'var(--color-app-active)',
                color: active ? '#fff' : 'var(--color-text-muted)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </label>
  );
}
