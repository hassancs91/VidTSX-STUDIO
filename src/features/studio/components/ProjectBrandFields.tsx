import { useState } from 'react';
import { Library } from 'lucide-react';
import { Select } from '@shared/components/Select';
import type { BrandOption } from '../hooks/useBrandList';
import type { PresetOption } from '../hooks/usePresetList';
import type { ProjectBrandState } from '../hooks/useProjectBrand';
import {
  brandOptions,
  brandValue,
  effectiveBrand,
  pickerChoice,
  presetOptions,
} from '../services/project-brand-options';
import { openLibraryForm } from '../services/open-library-form';
import { BrandReadout } from './BrandReadout';

interface Props {
  brands: BrandOption[];
  brandId: string | undefined;
  onSetBrand: (brandId: string | null) => void;
  presets: PresetOption[];
  presetId: string | undefined;
  onSetPreset: (presetId: string | null) => void;
  projectBrand: ProjectBrandState;
  /** "Create …" leaves the editor for the Assets screen. */
  onLeave: () => void;
}

/**
 * Brand + Preset in the Project settings panel (video-10 feedback item 7):
 * both rows always render, the project's own brand snapshot is a real option
 * with "Save to library", and "Create …" opens the Assets screen's form.
 */
export function ProjectBrandFields({
  brands,
  brandId,
  onSetBrand,
  presets,
  presetId,
  onSetPreset,
  projectBrand,
  onLeave,
}: Props) {
  const { snapshot, promote, promoting } = projectBrand;
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const { brand, source } = effectiveBrand(brands, brandId, snapshot);

  const pickBrand = (value: string) => {
    const choice = pickerChoice(value);
    if (choice.kind === 'create') {
      onLeave();
      openLibraryForm('brand');
    } else {
      onSetBrand(choice.kind === 'library' ? choice.id : null);
    }
  };

  const pickPreset = (value: string) => {
    const choice = pickerChoice(value);
    if (choice.kind === 'create') {
      onLeave();
      openLibraryForm('preset');
    } else {
      onSetPreset(choice.kind === 'library' ? choice.id : null);
    }
  };

  const saveToLibrary = async () => {
    setPromoteError(null);
    const result = await promote();
    if ('error' in result) setPromoteError(result.error);
    else onSetBrand(result.brandId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1" data-project-brand-picker>
        <span className="text-[10px] text-text-dim">
          Brand: palette, fonts and style notes for every generated shot and brand-coloured caption
        </span>
        <div className="flex items-center gap-1.5">
          <Select
            className="flex-1 min-w-0"
            value={brandValue(brandId, snapshot !== null)}
            onChange={pickBrand}
            options={brandOptions({ brands, brandId, snapshotName: snapshot?.name ?? null })}
          />
          {source === 'project' && (
            <button
              type="button"
              onClick={() => void saveToLibrary()}
              disabled={promoting}
              data-brand-save-to-library
              title="Copy this project's brand into the library (Assets › Brands) and use the library copy"
              className="flex items-center gap-1 px-2 h-[26px] rounded-[6px] text-[10px] text-text-secondary hover:bg-app-hover hover:text-text-primary transition-colors disabled:opacity-50 shrink-0"
              style={{ border: '0.5px solid var(--color-border-hover)' }}
            >
              <Library size={11} strokeWidth={1.5} />
              {promoting ? 'Saving…' : 'Save to library'}
            </button>
          )}
        </div>
        {promoteError && <span className="text-[10px] text-accent-red">{promoteError}</span>}
      </div>
      <BrandReadout brand={brand} source={source} />

      <label className="flex flex-col gap-1" data-project-preset-picker>
        <span className="text-[10px] text-text-dim">
          Editing preset: the workflow and instructions the assistant follows for a full edit
        </span>
        <Select value={presetId ?? ''} onChange={pickPreset} options={presetOptions({ presets, presetId })} />
      </label>
    </div>
  );
}
