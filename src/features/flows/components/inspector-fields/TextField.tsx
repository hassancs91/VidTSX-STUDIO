import { TextInput } from '@shared/components/TextInput';

interface Props {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

export function TextField({ label, value, onChange, placeholder }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
