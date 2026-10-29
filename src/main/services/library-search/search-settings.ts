// The library-search ladder setting + the model id, in the settings KV store (LIBRARY_SEARCH_DESIGN.md §4; the
// `library/library-prefs.ts` pattern). `librarySearchMode` unset = auto; `librarySearchModelId` unset =
// multilingual-e5-small. A stored value that is not one of ours reads as the default (never trusted).

import type { LibrarySearchChoice } from '../../../shared/types/library-search';
import { getValue, setValue } from '../settings-db';

export const DEFAULT_SEARCH_MODEL_ID = 'multilingual-e5-small';
const MODE_KEY = 'librarySearchMode';
const MODEL_KEY = 'librarySearchModelId';
const CHOICES: readonly LibrarySearchChoice[] = ['auto', 'basic', 'smart', 'smart-rerank'];

export interface StoredSearchSettings {
  choice: LibrarySearchChoice;
  modelId: string;
}

const isChoice = (v: unknown): v is LibrarySearchChoice => typeof v === 'string' && (CHOICES as readonly string[]).includes(v);

export function getLibrarySearchSettings(): StoredSearchSettings {
  const mode = getValue<unknown>(MODE_KEY);
  const model = getValue<unknown>(MODEL_KEY);
  return {
    choice: isChoice(mode) ? mode : 'auto',
    modelId: typeof model === 'string' && model.trim() ? model : DEFAULT_SEARCH_MODEL_ID,
  };
}

/** Auto is stored as unset; a field left out is left alone. */
export function setLibrarySearchSettings(patch: { mode?: LibrarySearchChoice; modelId?: string }): StoredSearchSettings {
  if (patch.mode !== undefined && !isChoice(patch.mode)) throw new Error(`Unknown library search mode: ${String(patch.mode)}`);
  if (patch.modelId !== undefined && !patch.modelId.trim()) throw new Error('The library search model id is empty');
  if (patch.mode !== undefined) setValue(MODE_KEY, patch.mode === 'auto' ? undefined : patch.mode);
  if (patch.modelId !== undefined) setValue(MODEL_KEY, patch.modelId === DEFAULT_SEARCH_MODEL_ID ? undefined : patch.modelId);
  return getLibrarySearchSettings();
}
