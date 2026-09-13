import type { StudioBrandPalette } from '@shared/types/asset-library';
import type { BrandOption } from '../hooks/useBrandList';
import type { BrandSource } from '../services/project-brand-options';

const PALETTE_ROLES: ReadonlyArray<keyof StudioBrandPalette> = ['primary', 'secondary', 'accent', 'background', 'text'];

interface Props {
  brand: BrandOption | null;
  source: BrandSource;
}

/**
 * What the brand supplies to shots and captions (video-10 feedback item 7):
 * the five palette roles as swatches, the fonts, and where the brand comes
 * from — the same resolution main uses, so this is what the export paints.
 */
export function BrandReadout({ brand, source }: Props) {
  if (!brand) {
    return (
      <p className="text-[10px] text-text-dim leading-snug" data-brand-readout="none">
        No brand: generated shots and brand-coloured captions use their own defaults.
      </p>
    );
  }
  return (
    <div
      className="flex flex-col gap-1.5 p-2 rounded-[6px] bg-app-base"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-brand-readout={source}
    >
      <div className="flex items-center gap-1">
        {PALETTE_ROLES.map((role) => (
          <span
            key={role}
            data-brand-swatch={role}
            title={`${role} ${brand.palette[role]}`}
            className="w-[22px] h-[22px] rounded-[4px] shrink-0"
            style={{ background: brand.palette[role], border: '0.5px solid var(--color-border-hover)' }}
          />
        ))}
        <span className="flex-1" />
        <span className="text-[9px] text-text-dim">
          {source === 'project' ? 'from this project (brand.json)' : 'from the library'}
        </span>
      </div>
      <div className="text-[10px] text-text-secondary truncate" data-brand-fonts>
        {brand.fonts.display || 'No display font'}
        {brand.fonts.body ? ` / ${brand.fonts.body}` : ''}
      </div>
    </div>
  );
}
