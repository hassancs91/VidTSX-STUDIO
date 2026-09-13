// Brand + Preset pickers of the Project settings panel (video-10 feedback
// item 7). Pure: which options the selects show, which one is selected, and
// what picking one means. The rules, from the feedback:
//
// - The Brand row always renders. A project-local snapshot (`brand.json`) is a
//   real option, selected when no library brand is set — main's
//   `resolveProjectBrand` already renders against it, silently until now.
// - The snapshot is a FALLBACK in main (a library brand wins, a stale id
//   degrades to it), so "No brand" cannot switch it off; it is offered only
//   when there is no snapshot.
// - A stale id (brand/preset deleted) shows as "(missing)" so the fallback is
//   visible, and "Create …" is always the last option.

export interface PickerOption {
  value: string;
  label: string;
}

/** The snapshot option's value — never a valid library slug (underscores). */
export const PROJECT_BRAND_VALUE = '__project-brand__';
/** "Create brand…" / "Create preset…" — opens the Assets screen's form. */
export const CREATE_VALUE = '__create__';

export type PickerChoice =
  | { kind: 'library'; id: string }
  | { kind: 'project' }
  | { kind: 'none' }
  | { kind: 'create' };

interface Named {
  id: string;
  name: string;
}

export function brandOptions(args: {
  brands: readonly Named[];
  brandId: string | undefined;
  snapshotName: string | null;
}): PickerOption[] {
  const { brands, brandId, snapshotName } = args;
  return [
    snapshotName !== null
      ? { value: PROJECT_BRAND_VALUE, label: `${snapshotName} (project snapshot)` }
      : { value: '', label: 'No brand' },
    ...brands.map((b) => ({ value: b.id, label: b.name })),
    ...(brandId && !brands.some((b) => b.id === brandId)
      ? [{ value: brandId, label: `${brandId} (missing)` }]
      : []),
    { value: CREATE_VALUE, label: 'Create brand…' },
  ];
}

export function brandValue(brandId: string | undefined, hasSnapshot: boolean): string {
  if (brandId) return brandId;
  return hasSnapshot ? PROJECT_BRAND_VALUE : '';
}

export function presetOptions(args: { presets: readonly Named[]; presetId: string | undefined }): PickerOption[] {
  const { presets, presetId } = args;
  return [
    { value: '', label: 'No preset' },
    ...presets.map((p) => ({ value: p.id, label: p.name })),
    ...(presetId && !presets.some((p) => p.id === presetId)
      ? [{ value: presetId, label: `${presetId} (missing)` }]
      : []),
    { value: CREATE_VALUE, label: 'Create preset…' },
  ];
}

/** What a picked value means. The snapshot and "none" both clear the id. */
export function pickerChoice(value: string): PickerChoice {
  if (value === CREATE_VALUE) return { kind: 'create' };
  if (value === PROJECT_BRAND_VALUE) return { kind: 'project' };
  if (value === '') return { kind: 'none' };
  return { kind: 'library', id: value };
}

export type BrandSource = 'library' | 'project' | 'none';

/**
 * The brand the project actually renders with, mirroring main's
 * `resolveProjectBrand`: the library brand when it exists, else the snapshot
 * (also when the library id went stale), else none. The read-out and the
 * caption previews use it, so the editor shows what the export will paint.
 */
export function effectiveBrand<B extends Named>(
  brands: readonly B[],
  brandId: string | undefined,
  snapshot: B | null,
): { brand: B | null; source: BrandSource } {
  const library = brandId ? brands.find((b) => b.id === brandId) : undefined;
  if (library) return { brand: library, source: 'library' };
  if (snapshot) return { brand: snapshot, source: 'project' };
  return { brand: null, source: 'none' };
}
