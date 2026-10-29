// E3 fix round 3 — the miss rule (E-d15) in generate_sfx / generate_music: when no
// library sound reaches the match threshold but some candidates still score, the
// tool answers the closest library sounds and generates NOTHING (no provider
// check, no engine, no normalizer, no import); only a TRUE miss — no word of the
// prompt in any clip — generates without `force`; `force` always generates. The
// REAL matcher runs over a mocked index; same mocks as audio-tools-reuse.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioToolContext } from './types';

const hasAudioProvider = vi.fn();
const generateAudioAsset = vi.fn();
const importLibraryFile = vi.fn();
const loadIndex = vi.fn();

vi.mock('../../library/generate-audio-asset', () => ({
  NO_AUDIO_PROVIDER_MESSAGE:
    'No audio provider is configured. Ask the user to add an ElevenLabs key in AI → Providers.',
  hasAudioProvider: () => hasAudioProvider(),
  generateAudioAsset: (req: unknown) => generateAudioAsset(req),
}));
vi.mock('./library-import', () => ({
  importLibraryFile: (ctx: unknown, relPath: string) => importLibraryFile(ctx, relPath),
}));
vi.mock('../project-store', () => ({
  loadProject: async () => ({ settings: { brandId: 'acme-test' } }),
}));
vi.mock('../../library/library-store', () => ({ loadIndex: (root: string) => loadIndex(root) }));
vi.mock('../../library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));

const { buildAudioTools } = await import('./audio-tools');

interface ToolLike {
  name: string;
  handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>;
}

function makeCtx(): { ctx: StudioToolContext } {
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  return { ctx };
}

function toolsByName(ctx: StudioToolContext): Record<string, ToolLike> {
  const out: Record<string, ToolLike> = {};
  for (const t of buildAudioTools(ctx) as unknown as ToolLike[]) out[t.name] = t;
  return out;
}

const AT = '2026-10-28T12:00:00.000Z';
const LIB = [
  {
    relPath: 'sfx/whoosh-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A short, soft air whoosh for a scene transition. Quick and clean, no metallic ring, no music.',
    probe: { duration: 0.6802, hasAudio: true },
    tags: ['whoosh', 'transition', 'cutaway', 'air', 'swipe', 'motion'],
    audio: { category: 'motion', loudnessLufs: -20, peakDbfs: -1.6, peakKind: 'sample' },
    usedIn: ['video-1', 'proj-e3'],
  },
  {
    relPath: 'sfx/whoosh-wind.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A soft, drawn-out wind whoosh for a gliding transition.',
    probe: { duration: 2.2, hasAudio: true }, tags: ['whoosh', 'wind', 'glide'], audio: { category: 'motion', loudnessLufs: -21.4 },
  },
  {
    relPath: 'sfx/clock-tick-soft.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A soft mechanical chess clock ticking gently, no bell, no music.',
    probe: { duration: 3, hasAudio: true }, tags: ['clock', 'tick', 'tock', 'timer'], audio: { category: 'texture' },
  },
  {
    relPath: 'music/lofi-warm.mp3', kind: 'audio', origin: 'imported', addedAt: AT,
    description: 'A warm, cozy lo-fi downtempo bed.', probe: { duration: 57.05, hasAudio: true },
    tags: ['lofi', 'warm', 'bed'], audio: { category: 'lofi' },
  },
];

beforeEach(() => {
  hasAudioProvider.mockReset();
  generateAudioAsset.mockReset();
  importLibraryFile.mockReset();
  loadIndex.mockReset();
  hasAudioProvider.mockResolvedValue(true);
  generateAudioAsset.mockImplementation(async (req: { kind: string }) => ({
    relPath: `generated/${req.kind}-x.mp3`, kind: req.kind, durationSeconds: 2.973, description: 'x',
    providerId: 'elevenlabs', model: 'm', normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2,
  }));
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/x.mp3' });
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries: LIB, tombstones: [] });
});

/** The match answer's opening — a miss must never read like it. */
const MATCH_OPENING = 'The library already has';

describe('Studio audio tools — the miss rule (E3 fix round 3, E-d15)', () => {
  it('generate_sfx: a miss answers the closest library sounds — nothing generated, no provider check, no engine, no import', async () => {
    hasAudioProvider.mockResolvedValue(false);
    const { ctx } = makeCtx();
    // "clock / tick / tock" hit clock-tick-soft's tags, "wind" / "airy" one whoosh each — none reaches the
    // threshold ("cuckoo" / "chime", the head, hit nothing), so every candidate is a nearest one.
    const prompt = 'a cuckoo clock chime, tick tock, wind, airy';
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt }, {});
    expect(res.isError).toBeUndefined();
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(
      `No library sound matched "${prompt}" well — nothing was generated (no cost, no provider needed). The closest library sounds:`,
    );
    // Fix round 4 (E-d16): the same wording, each row labelled `closest`.
    expect(lines[1]).toBe(
      '- [closest] library:sfx/clock-tick-soft.mp3 (audio, 3.00 s, imported) — "A soft mechanical chess clock ticking gently, no bell, no music." · category: texture · tags: clock, tick, tock, timer',
    );
    expect([lines[2], lines[3]].map((l) => l.slice(0, 40)).sort()).toEqual([
      '- [closest] library:sfx/whoosh-soft.mp3 ',
      '- [closest] library:sfx/whoosh-wind.mp3 ',
    ]);
    expect(lines[4]).toBe(
      'If one of them fits, place it with insert_asset(assetId: "library:sfx/clock-tick-soft.mp3", lane: "audio", at: …) — a library ref works as the asset id. If none fits, call generate_sfx again with force: true to generate a new one.',
    );
    expect(lines).toHaveLength(5);
    expect(res.content[0].text).not.toContain(MATCH_OPENING);
    expect(loadIndex).toHaveBeenCalledWith('C:/lib');
    expect(hasAudioProvider).not.toHaveBeenCalled();
    expect(generateAudioAsset).not.toHaveBeenCalled();
    expect(importLibraryFile).not.toHaveBeenCalled();
  });

  it('generate_sfx: a one-word near miss lists the one candidate that scored, nothing else', async () => {
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a cuckoo clock chime' }, {});
    const refs = [...res.content[0].text.matchAll(/library:(sfx\/[a-z0-9-]+\.mp3)/g)].map((m) => m[1]);
    expect(refs).toEqual(['sfx/clock-tick-soft.mp3', 'sfx/clock-tick-soft.mp3']); // the row, then the placement line
    expect(res.content[0].text.startsWith('No library sound matched "a cuckoo clock chime" well')).toBe(true);
    expect(generateAudioAsset).not.toHaveBeenCalled();
  });

  it('a TRUE miss (no word of the prompt in any clip) generates — with a provider; without one, says so', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    const res = await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(loadIndex).toHaveBeenCalledTimes(1);
    expect(generateAudioAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sfx', prompt: 'a dog bark' }));
    expect(res.content[0].text).toContain('project asset id "asset-9"');

    hasAudioProvider.mockResolvedValue(false);
    const none = await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toContain('No audio provider is configured');
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('force: true generates on a miss too, without looking at the library', async () => {
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a cuckoo clock chime', force: true }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
    expect(res.content[0].text).toContain('project asset id "asset-9"');
  });

  it('generate_music: a miss answers the closest beds; a bed shorter than the asked length is not even a nearest; a plan never looks', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    const near = await tools.generate_music.handler({ prompt: 'a warm bed for a cooking show' }, {});
    const text = near.content[0].text;
    expect(text).toContain(
      'No library sound matched "a warm bed for a cooking show" well — nothing was generated (no cost, no provider needed). The closest library sounds:',
    );
    expect(text).toContain('- [closest] library:music/lofi-warm.mp3 (audio, 57.05 s, imported)');
    expect(text).toContain('call generate_music again with force: true');
    expect(text).not.toContain('whoosh');
    expect(text).not.toContain(MATCH_OPENING);
    expect(hasAudioProvider).not.toHaveBeenCalled();
    expect(generateAudioAsset).not.toHaveBeenCalled();

    await tools.generate_music.handler({ prompt: 'a warm bed for a cooking show', durationSeconds: 90 }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);

    loadIndex.mockClear();
    await tools.generate_music.handler({ compositionPlan: { sections: [{ name: 'a', durationSec: 10 }] } }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
  });
});
