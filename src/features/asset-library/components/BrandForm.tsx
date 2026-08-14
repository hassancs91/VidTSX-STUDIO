import { useState } from 'react';
import type { StudioBrand, StudioBrandPalette } from '@shared/types/asset-library';
import { validateBrandInput, type StudioBrandInput } from '@shared/studio/brand';

const PALETTE_FIELDS: Array<{ key: keyof StudioBrandPalette; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'accent', label: 'Accent' },
];

const EMPTY: StudioBrandInput = {
  name: '',
  palette: { primary: '#7F77DD', secondary: '#c8b4ff', background: '#131316', text: '#e0e0e0', accent: '#EF9F27' },
  fonts: { display: '' },
  logoRefs: [],
  styleNotes: '',
};

const inputClass =
  'h-[26px] px-2 rounded bg-app-base text-text-primary text-[11px] focus:outline-none w-full';
const inputStyle = { border: '0.5px solid var(--color-border-input)' } as const;

/** Create/edit form for one brand (L3) — validation mirrors the store's. */
export function BrandForm({
  brand,
  onSave,
  onCancel,
}: {
  /** undefined = create */
  brand?: StudioBrand;
  onSave: (input: StudioBrandInput, brandId?: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<StudioBrandInput>(
    brand
      ? {
          name: brand.name,
          palette: { ...brand.palette },
          fonts: { ...brand.fonts },
          logoRefs: [...brand.logoRefs],
          styleNotes: brand.styleNotes ?? '',
        }
      : EMPTY,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const problems = validateBrandInput(input);
    if (problems.length > 0) {
      setErrors(problems);
      return;
    }
    setSaving(true);
    const error = await onSave(input, brand?.id);
    setSaving(false);
    if (error) setErrors([error]);
    else onCancel();
  };

  return (
    <div className="flex flex-col gap-2" data-brand-form>
      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Name
        <input
          autoFocus
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          placeholder="Brand name"
          data-brand-name
          className={inputClass}
          style={inputStyle}
        />
      </label>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {PALETTE_FIELDS.map(({ key, label }) => (
          <label key={key} className="flex flex-col gap-1 text-[10px] text-text-muted">
            {label}
            <div className="flex items-center gap-1.5">
              <span
                className="w-[18px] h-[18px] rounded shrink-0"
                style={{ background: input.palette[key], border: '0.5px solid var(--color-border)' }}
              />
              <input
                value={input.palette[key]}
                onChange={(e) =>
                  setInput({ ...input, palette: { ...input.palette, [key]: e.target.value } })
                }
                data-brand-color={key}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Display font
          <input
            value={input.fonts.display}
            onChange={(e) => setInput({ ...input, fonts: { ...input.fonts, display: e.target.value } })}
            placeholder="Inter"
            data-brand-font-display
            className={inputClass}
            style={inputStyle}
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] text-text-muted">
          Body font (optional)
          <input
            value={input.fonts.body ?? ''}
            onChange={(e) => {
              const body = e.target.value;
              const fonts = { display: input.fonts.display, ...(body ? { body } : {}) };
              setInput({ ...input, fonts });
            }}
            placeholder="Same as display"
            className={inputClass}
            style={inputStyle}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Logo files (library paths, comma-separated — used by shots once media-in-shots lands)
        <input
          value={(input.logoRefs ?? []).join(', ')}
          onChange={(e) =>
            setInput({
              ...input,
              logoRefs: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="logos/logo-white.png"
          className={inputClass}
          style={inputStyle}
        />
      </label>

      <label className="flex flex-col gap-1 text-[10px] text-text-muted">
        Style notes (injected into every shot prompt)
        <textarea
          value={input.styleNotes ?? ''}
          onChange={(e) => setInput({ ...input, styleNotes: e.target.value })}
          rows={3}
          placeholder="Minimal, generous whitespace, logo bottom-right…"
          className="px-2 py-1.5 rounded bg-app-base text-text-primary text-[11px] focus:outline-none resize-none"
          style={inputStyle}
        />
      </label>

      {errors.length > 0 && (
        <div className="text-[10px] text-accent-red leading-snug" data-brand-errors>
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded text-[11px] text-text-secondary hover:bg-app-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          data-brand-save
          className="px-3 py-1.5 rounded bg-accent text-white text-[11px] font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : brand ? 'Save changes' : 'Create brand'}
        </button>
      </div>
    </div>
  );
}
