import type { WhisperModel } from '@shared/ipc/types';
import type { CatalogRowData } from '../types';

/** The whisper sizes the Audio page recommends: fast · balanced · best (redesign §3.6). */
export const RECOMMENDED_WHISPER_IDS: readonly string[] = ['base', 'small', 'large-v3'];

/** One line per size so the row says who it is for without a tier chip (whisper.cpp is CPU-first). */
export const WHISPER_SIZE_HINTS: Record<string, string> = {
  tiny: 'Fastest, rough — quick previews',
  base: 'Fast — good for clean speech',
  small: 'Balanced — the everyday pick',
  medium: 'Slower — better with accents and noise',
  'large-v3': 'Best accuracy — slow without a strong CPU or GPU',
};

export interface WhisperCatalogSections {
  installed: WhisperModel[];
  /** Recommended sizes not yet downloaded. */
  recommended: WhisperModel[];
  /** Every size not yet downloaded (the recommended ones included). */
  all: WhisperModel[];
}

/** Whisper as one family on the local-model template: downloaded sizes are Installed, the rest are the catalog. */
export function splitWhisperCatalog(models: readonly WhisperModel[]): WhisperCatalogSections {
  const installed = models.filter((m) => m.downloaded);
  const all = models.filter((m) => !m.downloaded);
  return {
    installed,
    recommended: all.filter((m) => RECOMMENDED_WHISPER_IDS.includes(m.id)),
    all,
  };
}

/** A whisper size as the template's catalog row renders it (no tier, no link-only entries). */
export function whisperToCatalogRow(model: WhisperModel): CatalogRowData {
  return {
    id: model.id,
    name: `Whisper ${model.name}`,
    family: 'whisper',
    sizeLabel: model.size,
    hasDownload: true,
    ...(WHISPER_SIZE_HINTS[model.id] ? { hint: WHISPER_SIZE_HINTS[model.id] } : {}),
  };
}
