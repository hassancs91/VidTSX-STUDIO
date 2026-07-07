interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}

export function PromptField({ label, value, onChange, placeholder, rows = 5 }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="bg-app-base text-text-primary rounded-[6px] px-[8px] py-[6px] focus:outline-none resize-y"
        style={{
          fontSize: 11,
          border: '0.5px solid var(--color-border-input)',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--color-accent)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--color-border-input)';
        }}
      />
    </label>
  );
}
