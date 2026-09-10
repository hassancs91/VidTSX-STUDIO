import { Select } from '@shared/components/Select';

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
}

export function SelectField({ label, value, onChange, options }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <Select value={value} onChange={onChange} options={options} />
    </label>
  );
}
