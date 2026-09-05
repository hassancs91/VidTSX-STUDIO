/**
 * Pure gallery state for 3D Studio (newest first). The hook dispatches; tests cover
 * the transitions without React.
 */
import type { ThreedStudioEntry } from '../../../shared/ipc/types';
import type { GalleryModel } from '../types';
import { toFileUrl } from './threed-request';

export interface GalleryState {
  entries: GalleryModel[];
  basePath: string;
  loaded: boolean;
}

export type GalleryAction =
  | { type: 'loaded'; entries: ThreedStudioEntry[]; basePath: string }
  | { type: 'added'; entry: ThreedStudioEntry }
  | { type: 'removed'; id: string }
  | { type: 'removed-many'; ids: string[] };

export const INITIAL_GALLERY: GalleryState = { entries: [], basePath: '', loaded: false };

export function toGalleryModel(entry: ThreedStudioEntry, basePath: string): GalleryModel {
  const dir = `${basePath}\\${entry.dirName}`;
  return {
    ...entry,
    meshUrl: toFileUrl(`${dir}\\${entry.meshFileName}`),
    previewUrl: entry.previewFileName ? toFileUrl(`${dir}\\${entry.previewFileName}`) : null,
    inputUrl: entry.inputFileName ? toFileUrl(`${dir}\\${entry.inputFileName}`) : null,
  };
}

export function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case 'loaded':
      return { entries: action.entries.map((e) => toGalleryModel(e, action.basePath)), basePath: action.basePath, loaded: true };
    case 'added': {
      if (state.entries.some((e) => e.id === action.entry.id)) return state;
      return { ...state, entries: [toGalleryModel(action.entry, state.basePath), ...state.entries] };
    }
    case 'removed':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
    case 'removed-many': {
      const ids = new Set(action.ids);
      return { ...state, entries: state.entries.filter((e) => !ids.has(e.id)) };
    }
    default:
      return state;
  }
}
