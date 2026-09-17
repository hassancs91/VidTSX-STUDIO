import { useState, useEffect } from 'react';
import type { ParamValue, TemplateControl } from '@shared/types/templates';

export interface ParamFieldProps {
  control: TemplateControl;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
  /** `image` controls: open a picker. The field never touches IPC itself. */
  onPickImage?: () => void;
  /** `image` controls: a url the renderer can show for the current value. */
  imageUrl?: string | null;
  disabled?: boolean;
}

/** Past this many stops a slider cannot land on a value — the field is typed. */
const SLIDER_MAX_STEPS = 1000;

const inputClass =
  'w-full h-[26px] bg-app-base text-text-primary rounded-[6px] px-2 outline-none text-[11px] disabled:opacity-50';
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;

type Focusable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function focusHandlers(onBlurExtra?: () => void) {
  return {
    onFocus: (e: React.FocusEvent<Focusable>) => {
      e.target.style.borderColor = 'var(--color-accent)';
    },
    onBlur: (e: React.FocusEvent<Focusable>) => {
      e.target.style.borderColor = 'var(--color-border-input)';
      onBlurExtra?.();
    },
  };
}

/** Normalize any string to the 6-digit hex the native color input requires. */
function toHex6(value: string): string {
  const m = /^#([0-9a-f]{3})$/i.exec(value);
  if (m) return `#${m[1].split('').map((c) => c + c).join('')}`;
  return /^#[0-9a-f]{6}/i.test(value) ? value.slice(0, 7) : '#000000';
}

function clamp(n: number, min?: number, max?: number): number {
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

function fileNameOf(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/**
 * One declared control (NEXT_FEATURES_DESIGN Q8c `ParamSpec`, plus the text
 * and image kinds a template needs). Driven entirely by the manifest, so pack
 * authors never write UI — templates use it today, transitions and effects can
 * when they become pack kinds.
 */
export function ParamField({ control, value, onChange, onPickImage, imageUrl, disabled }: ParamFieldProps) {
  const modified = value !== control.default;
  // Local draft so intermediate number states ('', '-', '1.') don't commit.
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitNumber = (text: string) => {
    setDraft(text);
    const num = Number(text);
    if (text.trim() !== '' && Number.isFinite(num) && num === clamp(num, control.min, control.max)) onChange(num);
  };

  // Out-of-range or unfinished text snaps to the nearest legal value on blur.
  const settleNumber = () => {
    const num = Number(draft);
    const next = draft.trim() !== '' && Number.isFinite(num) ? clamp(num, control.min, control.max) : (value as number);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const label = (
    <span className="text-[10px] text-text-muted truncate" title={control.label}>
      {control.label}
    </span>
  );
  const dot = modified ? <span className="w-1 h-1 rounded-full bg-accent shrink-0" title="Changed" /> : null;
  const help = control.help ? <span className="text-[9px] text-text-dim leading-snug">{control.help}</span> : null;

  // A switch reads best on the label's own row.
  if (control.type === 'boolean') {
    const on = value === true;
    return (
      <div className="flex flex-col gap-1" data-param={control.key}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">{label}{dot}</div>
          <button
            onClick={() => onChange(!on)}
            disabled={disabled}
            className={`relative w-8 h-[18px] shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
              on ? 'bg-accent' : 'bg-app-hover'
            }`}
            role="switch"
            aria-checked={on}
            aria-label={control.label}
          >
            <span
              className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-all"
              style={{ left: on ? 16 : 2 }}
            />
          </button>
        </div>
        {help}
      </div>
    );
  }

  let field: React.ReactNode;
  switch (control.type) {
    case 'select':
      field = (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`${inputClass} cursor-pointer`}
          style={inputStyle}
          aria-label={control.label}
          {...focusHandlers()}
        >
          {(control.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      break;
    case 'color': {
      const text = typeof value === 'string' ? value : '';
      field = (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={toHex6(text)}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className="w-[26px] h-[26px] shrink-0 rounded-[6px] cursor-pointer bg-transparent"
            style={{ ...inputStyle, padding: 1 }}
            aria-label={`${control.label} picker`}
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(e.target.value)) onChange(e.target.value);
            }}
            disabled={disabled}
            className={inputClass}
            style={inputStyle}
            spellCheck={false}
            aria-label={control.label}
            {...focusHandlers(() => setDraft(text))}
          />
        </div>
      );
      break;
    }
    case 'number': {
      const text = (
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => commitNumber(e.target.value)}
          disabled={disabled}
          className={inputClass}
          style={inputStyle}
          spellCheck={false}
          aria-label={control.label}
          {...focusHandlers(settleNumber)}
        />
      );
      const { min, max, step } = control;
      // A slider only where dragging is a real way to choose: a bounded range of
      // at most SLIDER_MAX_STEPS stops (a subscriber count is typed, a split is felt).
      const slider = min !== undefined && max !== undefined && (step === undefined || (max - min) / step <= SLIDER_MAX_STEPS);
      field = slider ? (
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={min}
            max={max}
            step={step ?? 'any'}
            value={typeof value === 'number' ? value : min}
            onChange={(e) => {
              const n = Number(e.target.value);
              setDraft(String(n));
              onChange(n);
            }}
            disabled={disabled}
            className="flex-1 min-w-0 h-[26px] cursor-pointer disabled:opacity-50"
            style={{ accentColor: 'var(--color-accent)' }}
            aria-label={`${control.label} slider`}
          />
          <div className="w-[64px] shrink-0">{text}</div>
        </div>
      ) : text;
      break;
    }
    case 'textarea':
      field = (
        <textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={control.maxLength}
          placeholder={control.placeholder}
          disabled={disabled}
          rows={3}
          className="w-full bg-app-base text-text-primary rounded-[6px] px-2 py-1.5 outline-none text-[11px] resize-none disabled:opacity-50"
          style={{ ...inputStyle, fontFamily: 'inherit' }}
          aria-label={control.label}
          {...focusHandlers()}
        />
      );
      break;
    case 'image': {
      const path = typeof value === 'string' ? value : '';
      field = (
        <div className="flex items-center gap-1.5">
          <div
            className="w-[34px] h-[34px] shrink-0 rounded-[6px] overflow-hidden bg-app-base flex items-center justify-center"
            style={inputStyle}
          >
            {path && imageUrl ? (
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.2} className="text-text-dim">
                <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
                <circle cx="5.5" cy="6" r="1.2" />
                <path d="M2 12l3.5-3.5 2.5 2.5 2.5-3 3.5 4" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="text-[10px] text-text-secondary truncate" title={path || undefined}>
              {path ? fileNameOf(path) : 'None'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onPickImage}
                disabled={disabled || !onPickImage}
                className="text-[10px] text-accent-light hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-default"
              >
                {path ? 'Replace…' : 'Choose…'}
              </button>
              {path && (
                <button
                  onClick={() => onChange('')}
                  disabled={disabled}
                  className="text-[10px] text-text-dim hover:text-text-primary cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      );
      break;
    }
    default:
      field = (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          maxLength={control.maxLength}
          placeholder={control.placeholder}
          disabled={disabled}
          className={inputClass}
          style={inputStyle}
          spellCheck={false}
          aria-label={control.label}
          {...focusHandlers()}
        />
      );
  }

  return (
    <div className="flex flex-col gap-1" data-param={control.key}>
      <div className="flex items-center gap-1.5 min-w-0">{label}{dot}</div>
      {field}
      {help}
    </div>
  );
}
