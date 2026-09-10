// The Creator's brand picker with its swatch strip (decision 7: one picker
// feeds both the prompt pipeline and, in Agent mode, the session).

import type { StudioBrand } from '@shared/types/asset-library';

interface Props {
  brands: StudioBrand[];
  /** '' = none. */
  selectedBrandId: string;
  onChange: (brandId: string) => void;
  disabled?: boolean;
}

export function MotionBrandField({ brands, selectedBrandId, onChange, disabled }: Props) {
  const brand = brands.find((b) => b.id === selectedBrandId);
  const swatches = brand
    ? [
        brand.palette.primary,
        brand.palette.secondary,
        brand.palette.background,
        brand.palette.text,
        brand.palette.accent,
      ]
    : [];

  return (
    <div className="px-3 pb-3 flex flex-col gap-1">
      <label className="text-[10px] text-text-dim">
        Brand <span className="text-text-dim">(optional)</span>
      </label>
      <select
        className="bg-app-base border border-border rounded-[6px] px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent cursor-pointer w-full"
        value={selectedBrandId}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-motion-brand
      >
        <option value="">None</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {brand ? (
        <div className="flex gap-1 mt-1">
          {swatches.map((color, i) => (
            <div
              key={i}
              className="flex-1 h-[14px] rounded-[3px]"
              style={{ backgroundColor: color, border: '0.5px solid var(--color-border)' }}
              title={color}
            />
          ))}
        </div>
      ) : brands.length === 0 ? (
        <span className="text-[9px] text-text-dim">
          Create brands in Assets to reuse your colors and fonts.
        </span>
      ) : null}
    </div>
  );
}
