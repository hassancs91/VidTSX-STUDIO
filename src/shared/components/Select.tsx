import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (next: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  size = 'sm',
  className = '',
}: SelectProps) {
  const sizeClasses = size === 'sm' ? 'h-[26px]' : 'h-[32px]';

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          w-full appearance-none bg-app-base text-text-primary
          rounded-[6px] pl-[8px] pr-[26px] focus:outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses}
        `}
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
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        strokeWidth={1.5}
        className="absolute right-[8px] top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
}
