import { describe, expect, it } from 'vitest';
import type { LibraryIndexEntry } from '../../../shared/types/asset-library';
import { changedFields, mapCatalogClip, NO_LICENCE_NOTE, parseCatalog } from './catalog-import-map';

/**
 * E4 (T6 "Importer"): the pure half of the catalog importer — parse the reference
 * `sfx/` + `music/` catalogs and map one clip to an index entry's fields. The clips
 * below are shaped exactly like the real ones (inspected read-only 2026-10-28).
 */

const LICENCE = "ElevenLabs generated (text-to-sfx); owner: the repo author, commercial use per the account's ElevenLabs plan";
const WHOOSH = {
  id: 'whoosh-soft', file: 'clips/whoosh-soft.mp3', category: 'motion',
  tags: ['whoosh', 'transition', 'cutaway', 'air', 'swipe', 'motion'], duration_s: 0.68, peak_dbfs: -1.6,
  loudness_lufs: -20, source: 'elevenlabs:sound-generation', model: 'eleven_text_to_sound_v2', license: LICENCE,
  prompt: 'A short, soft air whoosh for a scene transition.', used_in: ['short-1-chess', 'video-2'],
};
const CHORD = {
  id: 'piano-c-maj', file: 'clips/piano-c-maj.mp3', desc: 'C major triad (I) — warm electric-piano voicing',
  function: 'content', source: 'gen_chords.py (deterministic additive synth, equal temperament A4=440)',
  duration_s: 2.6, used_in: ['short-9-chords'],
};
const MUSIC = {
  id: 'ambient-pad', file: 'clips/ambient-pad.mp3', category: 'Ambient', tags: ['Ambient', ' pad ', 'ambient'],
  duration_s: 63.033, requested_ms: 63000, peak_dbfs: -4.9, loudness_lufs: -20, source: 'elevenlabs:music',
  model: 'music_v2', force_instrumental: true, license: 'ElevenLabs generated (text-to-music)', prompt: 'A minimal bed.',
  used_in: [],
};

describe('parseCatalog', () => {
  it('reads { note, clips[] } and keeps every valid clip', () => {
    const r = parseCatalog({ note: 'n', clips: [WHOOSH, CHORD] });
    expect(r.problems).toEqual([]);
    expect(r.clips.map((c) => c.id)).toEqual(['whoosh-soft', 'piano-c-maj']);
    expect(r.clips[1]).toMatchObject({ desc: CHORD.desc, function: 'content', usedIn: ['short-9-chords'] });
  });

  it('reports a clip it cannot use instead of throwing (bad file, bad id, bad used_in, not audio)', () => {
    const r = parseCatalog({
      clips: [
        { ...WHOOSH, id: 'a', file: '../escape.mp3' },
        { ...WHOOSH, id: 'b', file: 'C:/abs/b.mp3' },
        { ...WHOOSH, id: '', file: 'clips/x.mp3' },
        { ...WHOOSH, id: 'c', used_in: 'short-1' },
        { ...WHOOSH, id: 'd', file: 'clips/d.png' },
        'not an object',
        { ...WHOOSH, id: 'ok', file: 'clips/ok.mp3' },
      ],
    });
    expect(r.clips.map((c) => c.id)).toEqual(['ok']);
    expect(r.problems).toHaveLength(6);
    expect(r.problems.join('\n')).toMatch(/escape/);
  });

  it('refuses a document without a clips array', () => {
    expect(parseCatalog({ note: 'x' }).problems).toEqual(['the catalog has no "clips" array']);
    expect(parseCatalog(null).clips).toEqual([]);
  });
});

describe('mapCatalogClip', () => {
  it('maps an sfx clip: sfx/<file name>, prompt → description, the audio fields, used_in verbatim', () => {
    const [clip] = parseCatalog({ clips: [WHOOSH] }).clips;
    const m = mapCatalogClip('sfx', clip);
    expect(m.relPath).toBe('sfx/whoosh-soft.mp3');
    expect(m.description).toBe(WHOOSH.prompt);
    expect(m.tags).toEqual(WHOOSH.tags);
    expect(m.audio).toEqual({
      category: 'motion', loudnessLufs: -20, peakDbfs: -1.6, peakKind: 'sample',
      source: 'elevenlabs:sound-generation', model: 'eleven_text_to_sound_v2', license: LICENCE,
    });
    expect(m.usedIn).toEqual(['short-1-chess', 'video-2']);
    expect(m.catalogDurationS).toBe(0.68);
    expect(m.dropped).toEqual([]);
    expect(m.notes).toEqual([]);
  });

  it('maps a synth chord with what it has and notes the missing licence', () => {
    const [clip] = parseCatalog({ clips: [CHORD] }).clips;
    const m = mapCatalogClip('sfx', clip);
    expect(m.relPath).toBe('sfx/piano-c-maj.mp3');
    expect(m.description).toBe(`${CHORD.desc} (${NO_LICENCE_NOTE})`);
    expect(m.tags).toBeUndefined();
    expect(m.audio).toEqual({ source: CHORD.source });
    expect(m.usedIn).toEqual(['short-9-chords']);
    expect(m.notes).toEqual([NO_LICENCE_NOTE]);
    expect(m.dropped).toEqual(['function']);
  });

  it('maps a music clip under music/, normalizes category + tags, drops the request parameters', () => {
    const [clip] = parseCatalog({ clips: [MUSIC] }).clips;
    const m = mapCatalogClip('music', clip);
    expect(m.relPath).toBe('music/ambient-pad.mp3');
    expect(m.audio.category).toBe('ambient');
    expect(m.tags).toEqual(['ambient', 'pad']);
    expect(m.usedIn).toEqual([]);
    expect(m.dropped).toEqual(['requested_ms', 'force_instrumental']);
  });
});

describe('changedFields', () => {
  const [clip] = parseCatalog({ clips: [WHOOSH] }).clips;
  const m = mapCatalogClip('sfx', clip);
  const entry = (over: Partial<LibraryIndexEntry> = {}): LibraryIndexEntry => ({
    relPath: m.relPath, origin: 'imported', addedAt: 't', kind: 'audio', description: m.description,
    tags: [...(m.tags ?? [])], audio: { ...m.audio }, usedIn: [...m.usedIn], ...over,
  });

  it('is empty when the entry already carries the mapped fields (key order ignored)', () => {
    const reordered = entry({ audio: { license: LICENCE, model: m.audio.model, source: m.audio.source,
      peakKind: 'sample', peakDbfs: -1.6, loudnessLufs: -20, category: 'motion' } });
    expect(changedFields(reordered, m)).toEqual([]);
  });

  it('names what differs; a Studio project id E2 added to usedIn is not a difference', () => {
    expect(changedFields(undefined, m)).toEqual(['entry']);
    expect(changedFields(entry({ tags: ['whoosh'] }), m)).toEqual(['tags']);
    expect(changedFields(entry({ description: 'edited', origin: 'generated' }), m)).toEqual(['origin', 'description']);
    expect(changedFields(entry({ audio: { ...m.audio, loudnessLufs: -21 } }), m)).toEqual(['audio']);
    expect(changedFields(entry({ usedIn: ['proj-studio-1', ...m.usedIn] }), m)).toEqual([]);
    expect(changedFields(entry({ usedIn: ['short-1-chess'] }), m)).toEqual(['usedIn']);
  });
});
