import { useState } from 'react';
import type { StudioBrand } from '@shared/types/asset-library';
import type { StudioBrandInput } from '@shared/studio/brand';
import { BrandForm } from './BrandForm';

/**
 * Brands manager (L3, lean): list with swatches + default control, and a
 * create/edit form. Brands live at brands/<id>/ inside the assets root, so
 * every mutation also refreshes the surrounding Assets screen (onMutated).
 */
export function BrandsDialog({
  brands,
  defaultBrandId,
  onSave,
  onDelete,
  onSetDefault,
  onMutated,
  onClose,
}: {
  brands: StudioBrand[];
  defaultBrandId?: string;
  onSave: (input: StudioBrandInput, brandId?: string) => Promise<string | null>;
  onDelete: (brandId: string) => Promise<string | null>;
  onSetDefault: (brandId: string | null) => Promise<string | null>;
  onMutated: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<StudioBrand | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (input: StudioBrandInput, brandId?: string) => {
    const err = await onSave(input, brandId);
    if (!err) onMutated();
    return err;
  };

  const remove = async (brand: StudioBrand) => {
    const ok = window.confirm(
      `Delete brand "${brand.name}"? Projects using it fall back to no brand; logo files stay in the library.`,
    );
    if (!ok) return;
    setError(await onDelete(brand.id));
    onMutated();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        data-brands-dialog
        className="w-[480px] max-h-[80vh] overflow-y-auto p-4 rounded-md bg-app-surface flex flex-col gap-3"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-medium text-text-primary">
            {editing === 'new' ? 'New brand' : editing ? `Edit ${editing.name}` : 'Brands'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded text-[11px] text-text-muted hover:bg-app-hover"
          >
            Close
          </button>
        </div>

        {editing !== null ? (
          <BrandForm
            {...(editing === 'new' ? {} : { brand: editing })}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <>
            {brands.length === 0 && (
              <div className="text-[11px] text-text-dim leading-snug">
                No brands yet. A brand's palette, fonts, and style notes are injected into every
                generated shot; the default brand is copied into new projects.
              </div>
            )}
            {brands.map((brand) => (
              <BrandRow
                key={brand.id}
                brand={brand}
                isDefault={brand.id === defaultBrandId}
                onEdit={() => setEditing(brand)}
                onDelete={() => void remove(brand)}
                onToggleDefault={() =>
                  void onSetDefault(brand.id === defaultBrandId ? null : brand.id).then(setError)
                }
              />
            ))}
            {error && <div className="text-[10px] text-accent-red">{error}</div>}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditing('new')}
                data-brand-new
                className="px-3 py-1.5 rounded bg-accent text-white text-[11px] font-medium hover:opacity-90"
              >
                New brand
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BrandRow({
  brand,
  isDefault,
  onEdit,
  onDelete,
  onToggleDefault,
}: {
  brand: StudioBrand;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
}) {
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-[6px] bg-app-base"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-brand-row={brand.id}
    >
      <div className="flex gap-[3px] shrink-0">
        {Object.values(brand.palette).map((color, i) => (
          <span
            key={i}
            className="w-[14px] h-[14px] rounded-[3px]"
            style={{ background: color, border: '0.5px solid var(--color-border)' }}
            title={color}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-text-primary truncate">{brand.name}</span>
          {isDefault && (
            <span
              className="text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full shrink-0"
              style={{ background: 'var(--color-accent-green-bg, #085041)', color: '#5DCAA5' }}
              data-brand-default-badge
            >
              default
            </span>
          )}
        </div>
        <div className="text-[10px] text-text-dim truncate">
          {brand.fonts.display}
          {brand.fonts.body ? ` / ${brand.fonts.body}` : ''}
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleDefault}
        data-brand-set-default
        className="px-2 py-1 rounded text-[10px] text-text-muted hover:bg-app-hover shrink-0"
        title={isDefault ? 'Clear the app default' : 'New projects start with this brand'}
      >
        {isDefault ? 'Unset default' : 'Set default'}
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="px-2 py-1 rounded text-[10px] text-text-muted hover:bg-app-hover shrink-0"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="px-2 py-1 rounded text-[10px] text-accent-red hover:bg-app-hover shrink-0"
      >
        Delete
      </button>
    </div>
  );
}
