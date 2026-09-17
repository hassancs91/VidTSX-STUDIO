import { describe, expect, it } from 'vitest';
import type { WhisperModel } from '@shared/ipc/types';
import { RECOMMENDED_WHISPER_IDS, splitWhisperCatalog, whisperToCatalogRow } from './whisper-catalog';

const MODELS: WhisperModel[] = [
  { id: 'tiny', name: 'Tiny', size: '75 MB', sizeBytes: 1, downloaded: false },
  { id: 'base', name: 'Base', size: '142 MB', sizeBytes: 2, downloaded: true },
  { id: 'small', name: 'Small', size: '466 MB', sizeBytes: 3, downloaded: false },
  { id: 'medium', name: 'Medium', size: '1.5 GB', sizeBytes: 4, downloaded: false },
  { id: 'large-v3', name: 'Large-v3', size: '3.1 GB', sizeBytes: 5, downloaded: false },
];

describe('splitWhisperCatalog', () => {
  it('splits downloaded sizes from the catalog and picks the recommended ladder', () => {
    const sections = splitWhisperCatalog(MODELS);
    expect(sections.installed.map((m) => m.id)).toEqual(['base']);
    expect(sections.recommended.map((m) => m.id)).toEqual(['small', 'large-v3']);
    expect(sections.all.map((m) => m.id)).toEqual(['tiny', 'small', 'medium', 'large-v3']);
  });

  it('recommends exactly the fast / balanced / best sizes', () => {
    expect(RECOMMENDED_WHISPER_IDS).toEqual(['base', 'small', 'large-v3']);
  });
});

describe('whisperToCatalogRow', () => {
  it('renders a size as a Whisper-family row with its hint and no link-only entry', () => {
    const row = whisperToCatalogRow(MODELS[2]);
    expect(row).toEqual({
      id: 'small',
      name: 'Whisper Small',
      family: 'whisper',
      sizeLabel: '466 MB',
      hasDownload: true,
      hint: 'Balanced — the everyday pick',
    });
  });
});
