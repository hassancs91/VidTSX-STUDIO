import type { ImageModelParams, ImageParamField, ImageParamSchema } from '@shared/presets/image-model-params';

interface ImageParamFieldsProps {
  schema: ImageParamSchema;
  /** The fields the user has set (undefined = "use the default"). */
  values: ImageModelParams;
  /** Shown as placeholders: the model's defaults, overlaid with any saved override. */
  defaults?: ImageModelParams;
  onChange: (next: ImageModelParams) => void;
  disabled?: boolean;
  /** Two columns for the numeric fields (dialog); one column in the narrow Image Studio panel. */
  columns?: 1 | 2;
}

const INPUT_CLASS =
  'w-full bg-app-base border border-border rounded px-2 text-[11px] text-text-primary outline-none focus:border-accent placeholder:text-text-dim disabled:opacity-50';

function placeholderFor(field: ImageParamField, defaults?: ImageModelParams): string {
  const value = defaults?.[field.key];
  if (value === undefined || value === '') return field.kind === 'select' ? 'default' : 'default';
  return String(value);
}

/**
 * The schema-driven parameter form shared by the per-model params dialog
 * (AI → Models) and Image Studio's advanced panel. It renders exactly
 * `schema.fields` — never a hardcoded list — so a model's dialog shows only
 * what its family or API dialect declares. An empty input means "unset":
 * the model's saved override, then its own defaults, apply.
 */
export function ImageParamFields({
  schema,
  values,
  defaults,
  onChange,
  disabled,
  columns = 2,
}: ImageParamFieldsProps) {
  if (schema.fields.length === 0) {
    return (
      <div className="text-[11px] text-text-dim">
        This model's API takes no generation parameters beyond the prompt and size.
      </div>
    );
  }

  const set = (key: ImageParamField['key'], raw: string) => {
    const next: ImageModelParams = { ...values };
    if (raw === '') {
      delete next[key];
    } else if (key === 'sampler' || key === 'scheduler' || key === 'negativePrompt') {
      next[key] = raw;
    } else {
      const n = Number(raw);
      if (Number.isFinite(n)) next[key] = n;
    }
    onChange(next);
  };

  const compact = schema.fields.filter((f) => f.kind !== 'text');
  const wide = schema.fields.filter((f) => f.kind === 'text');

  return (
    <div className="flex flex-col gap-2">
      <div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {compact.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] text-text-dim">{field.label}</span>
            {field.kind === 'select' ? (
              <select
                className={`${INPUT_CLASS} h-[26px] cursor-pointer`}
                value={values[field.key] === undefined ? '' : String(values[field.key])}
                onChange={(e) => set(field.key, e.target.value)}
                disabled={disabled}
              >
                <option value="">{`default${defaults?.[field.key] ? ` (${defaults[field.key]})` : ''}`}</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                className={`${INPUT_CLASS} h-[26px]`}
                value={values[field.key] === undefined ? '' : String(values[field.key])}
                placeholder={placeholderFor(field, defaults)}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(e) => set(field.key, e.target.value)}
                disabled={disabled}
              />
            )}
            {field.hint && <span className="text-[9px] text-text-dim leading-tight">{field.hint}</span>}
          </label>
        ))}
      </div>
      {wide.map((field) => (
        <label key={field.key} className="flex flex-col gap-1">
          <span className="text-[10px] text-text-dim">{field.label}</span>
          <textarea
            className={`${INPUT_CLASS} py-1.5 h-[56px] resize-none`}
            value={values[field.key] === undefined ? '' : String(values[field.key])}
            placeholder={placeholderFor(field, defaults)}
            onChange={(e) => set(field.key, e.target.value)}
            disabled={disabled}
          />
          {field.hint && <span className="text-[9px] text-text-dim leading-tight">{field.hint}</span>}
        </label>
      ))}
    </div>
  );
}
