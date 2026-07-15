/**
 * Category registry — each engine registers its `ModelCategoryDescriptor` here.
 * The generic `TMeta` is erased on storage; callers narrow via `getCategory`.
 * No `electron` import.
 */
import type {
  ModelCategory,
  ModelCategoryDescriptor,
} from '@shared/model-library/types';

const categories = new Map<ModelCategory, ModelCategoryDescriptor<unknown>>();

export function registerCategory<TMeta, TResolved>(
  descriptor: ModelCategoryDescriptor<TMeta, TResolved>,
): void {
  // Erase the payload generic for storage; consumers re-narrow on read.
  categories.set(
    descriptor.category,
    descriptor as unknown as ModelCategoryDescriptor<unknown>,
  );
}

export function getCategory(
  category: ModelCategory,
): ModelCategoryDescriptor<unknown> | undefined {
  return categories.get(category);
}

export function listCategories(): ModelCategoryDescriptor<unknown>[] {
  return [...categories.values()];
}

/** Test-only: clear registered categories. */
export function __resetCategoryRegistry(): void {
  categories.clear();
}
