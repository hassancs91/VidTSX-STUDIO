import { TextInput } from '@shared/components/TextInput';

interface Props {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField({ label, value, onChange, min, max, step }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <TextInput
        type="number"
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}
