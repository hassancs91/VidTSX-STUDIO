import { describe, expect, it } from 'vitest';
import { VIDEO_MODEL_CATALOG } from './model-registry';
import type { VideoModelFamily } from './types';

const FAMILIES: VideoModelFamily[] = ['wan21', 'wan22', 'ltx', 'lingbot'];

/** Profiles whose repo file has a generic name and is renamed to matchFileNames[0] on download. */
const RENAMED_ON_DOWNLOAD = new Set(['lingbot-dense-1.3b']);

describe('VIDEO_MODEL_CATALOG', () => {
  it('every profile has an https sourceUrl', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      expect(p.sourceUrl, p.id).toMatch(/^https:\/\//);
    }
  });

  it('downloadUrl (when present) is https and never learnwithhasan.com', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (p.downloadUrl) {
        expect(p.downloadUrl.startsWith('https://'), p.id).toBe(true);
        expect(p.downloadUrl.includes('learnwithhasan.com'), p.id).toBe(false);
      }
    }
  });

  it('has unique ids', () => {
    const ids = VIDEO_MODEL_CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matchFileNames are unique across all profiles (case-insensitive)', () => {
    const all = VIDEO_MODEL_CATALOG.flatMap((p) => (p.matchFileNames ?? []).map((n) => n.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });

  it('every profile is category "video" with a valid family', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      expect(p.category).toBe('video');
      expect(FAMILIES).toContain(p.meta.family);
    }
  });

  it('every wan profile declares its required companions (t5xxl + vae)', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (p.meta.family !== 'wan21' && p.meta.family !== 'wan22') continue;
      const kinds = (p.meta.companions ?? []).map((c) => c.kind);
      expect(kinds, p.id).toEqual(expect.arrayContaining(['t5xxl', 'vae']));
    }
  });

  it('every companion requirement has fileNames + an https sourceUrl', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      for (const c of p.meta.companions ?? []) {
        expect(c.fileNames.length, `${p.id}:${c.kind}`).toBeGreaterThan(0);
        expect(c.sourceUrl, `${p.id}:${c.kind}`).toMatch(/^https:\/\//);
      }
    }
  });

  it('every ltx profile declares its required companions (llm + embeddings + vae + audio_vae)', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (p.meta.family !== 'ltx') continue;
      const kinds = (p.meta.companions ?? []).map((c) => c.kind);
      expect(kinds, p.id).toEqual(expect.arrayContaining(['llm', 'embeddings', 'vae', 'audio_vae']));
    }
  });

  it('i2v-capable wan21 profiles require clip_vision', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (p.meta.family !== 'wan21' || !p.meta.capabilities.i2v) continue;
      const kinds = (p.meta.companions ?? []).map((c) => c.kind);
      expect(kinds, p.id).toContain('clip_vision');
    }
  });

  it('companion downloadUrls point at their preferred fileName and carry a size', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      for (const c of p.meta.companions ?? []) {
        if (!c.downloadUrl) continue;
        expect(c.downloadUrl.endsWith(c.fileNames[0]), `${p.id}:${c.kind}`).toBe(true);
        expect(c.sizeBytes, `${p.id}:${c.kind}`).toBeGreaterThan(0);
      }
    }
  });

  it('wan frame defaults follow the 4n+1 rule', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (p.meta.family !== 'wan21' && p.meta.family !== 'wan22') continue;
      expect((p.meta.defaults.frames - 1) % 4, p.id).toBe(0);
    }
  });

  it('model downloadUrls point at their canonical matchFileName (unless renamed on download)', () => {
    for (const p of VIDEO_MODEL_CATALOG) {
      if (!p.downloadUrl || !p.matchFileNames?.length) continue;
      if (RENAMED_ON_DOWNLOAD.has(p.id)) continue;
      expect(p.downloadUrl.endsWith(p.matchFileNames[0]), p.id).toBe(true);
    }
  });
});
