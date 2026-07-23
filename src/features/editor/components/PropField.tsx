import { useState, useEffect } from 'react';
import type { ExtractedProp, PropValue } from '../types';

export interface PropFieldProps {
  prop: ExtractedProp;
  /** Current override, if the user changed this prop. */
  value: PropValue | undefined;
  onChange: (value: PropValue) => void;
}

const inputClass =
  'w-full bg-app-base text-text-primary rounded-[6px] px-2 py-1 outline-none text-[11px]';
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;

function focusHandlers() {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.target.style.borderColor = 'var(--color-accent)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      e.target.style.borderColor = 'var(--color-border-input)';
    },
  };
}

/** Normalize any string to the 6-digit hex the native color input requires. */
function toHex6(value: string): string {
  const m = /^#([0-9a-f]{3})$/i.exec(value);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000';
}

export function PropField({ prop, value, onChange }: PropFieldProps) {
  const current = value ?? prop.defaultValue;
  // Local draft so intermediate number states ('', '-', '1.') don't commit.
  const [draft, setDraft] = useState(current === null ? '' : String(current));

  useEffect(() => {
    setDraft(current === null ? '' : String(current));
  }, [current]);

  const commitNumber = (text: string) => {
    setDraft(text);
    const num = Number(text);
    if (text.trim() !== '' && Number.isFinite(num)) onChange(num);
  };

  let control: React.ReactNode;
  switch (prop.control) {
    case 'boolean': {
      const on = current === true;
      control = (
        <button
          onClick={() => onChange(!on)}
          className={`relative w-8 h-[18px] rounded-full transition-colors cursor-pointer ${
            on ? 'bg-accent' : 'bg-app-hover'
          }`}
          role="switch"
          aria-checked={on}
          aria-label={prop.name}
        >
          <span
            className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
            style={{ left: on ? 16 : 2 }}
          />
        </button>
      );
      break;
    }
    case 'select':
      control = (
        <select
          value={typeof current === 'string' ? current : ''}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} cursor-pointer`}
          style={inputStyle}
          {...focusHandlers()}
        >
          {(prop.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
      break;
    case 'color': {
      const text = typeof current === 'string' ? current : '';
      control = (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={toHex6(text)}
            onChange={(e) => onChange(e.target.value)}
            className="w-6 h-6 shrink-0 rounded cursor-pointer bg-transparent"
            style={{ border: '0.5px solid var(--color-border-input)', padding: 1 }}
            aria-label={`${prop.name} color`}
          />
          <input
            type="text"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
            style={inputStyle}
            spellCheck={false}
            {...focusHandlers()}
          />
        </div>
      );
      break;
    }
    case 'number':
      control = (
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => commitNumber(e.target.value)}
          className={inputClass}
          style={inputStyle}
          spellCheck={false}
          {...focusHandlers()}
        />
      );
      break;
    default:
      control = (
        <input
          type="text"
          value={typeof current === 'string' ? current : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
          spellCheck={false}
          {...focusHandlers()}
        />
      );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-muted truncate" title={prop.name}>
          {prop.name}
        </span>
        {value !== undefined && (
          <span className="w-1 h-1 rounded-full bg-accent shrink-0" title="Modified" />
        )}
      </div>
      {control}
    </div>
  );
}
