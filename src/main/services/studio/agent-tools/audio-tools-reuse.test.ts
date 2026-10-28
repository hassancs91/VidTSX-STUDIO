// E3 — reuse before generate in the Studio generate_sfx / generate_music tools:
// the REAL matcher runs over a mocked library index; matches answer BEFORE the
// provider check (no provider call, no engine, no import); `force` generates.
// Split out of audio-tools.test.ts (fix round 1) — same mocks.
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

describe('Studio audio tools — reuse before generate (E3)', () => {
  it('generate_sfx answers the top library matches BEFORE the provider check — no provider call, no engine, no import', async () => {
    hasAudioProvider.mockResolvedValue(false);
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'a soft airy whoosh for a transition' }, {});
    expect(res.isError).toBeUndefined();
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(
      'The library already has 2 sounds matching "a soft airy whoosh for a transition" — nothing was generated (no cost, no provider needed):',
    );
    expect(lines[1]).toBe(
      '- library:sfx/whoosh-soft.mp3 (audio, 0.68 s, imported) — "A short, soft air whoosh for a scene transition. Quick and clean, no metallic ring, no music." · category: motion · tags: whoosh, transition, cutaway, air, swipe, motion · −20.0 LUFS · used in: video-1, proj-e3',
    );
    expect(lines[2]).toMatch(/^- library:sfx\/whoosh-wind\.mp3 \(audio, 2\.20 s, imported\)/);
    expect(lines[3]).toContain('insert_asset(assetId: "library:sfx/whoosh-soft.mp3", lane: "audio"');
    expect(lines[3]).toContain('call generate_sfx again with force: true');
    expect(loadIndex).toHaveBeenCalledWith('C:/lib');
    expect(hasAudioProvider).not.toHaveBeenCalled();
    expect(generateAudioAsset).not.toHaveBeenCalled();
    expect(importLibraryFile).not.toHaveBeenCalled();
  });

  it('generate_sfx force: true generates even though the library has matches (and skips the lookup)', async () => {
    const { ctx } = makeCtx();
    const res = await toolsByName(ctx).generate_sfx.handler({ prompt: 'soft whoosh', force: true }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sfx', prompt: 'soft whoosh' }));
    expect(res.content[0].text).toContain('project asset id "asset-9"');
  });

  it('generate_music force: true generates even though a library bed matches (and skips the lookup)', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    // Control: the same ask without force is answered from the library.
    expect((await tools.generate_music.handler({ prompt: 'warm lo-fi bed' }, {})).content[0].text).toContain('library:music/lofi-warm.mp3');
    loadIndex.mockClear();
    const res = await tools.generate_music.handler({ prompt: 'warm lo-fi bed', force: true }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
    expect(generateAudioAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: 'music', prompt: 'warm lo-fi bed' }));
    expect(res.content[0].text).toContain('project asset id "asset-9"');
    expect(res.content[0].text).not.toContain('The library already has');
  });

  it('a sound the library does not have generates as before — or, with no provider, says so', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    await tools.generate_sfx.handler({ prompt: 'a cuckoo clock chime' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);

    hasAudioProvider.mockResolvedValue(false);
    const none = await tools.generate_sfx.handler({ prompt: 'a cuckoo clock chime' }, {});
    expect(none.isError).toBe(true);
    expect(none.content[0].text).toContain('No audio provider is configured');
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('an unreadable library index never blocks a generation', async () => {
    loadIndex.mockRejectedValue(new Error('EACCES'));
    const { ctx } = makeCtx();
    await toolsByName(ctx).generate_sfx.handler({ prompt: 'soft whoosh' }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);
  });

  it('generate_music: a matching bed is offered; one shorter than the asked length is not; a composition plan never looks', async () => {
    const { ctx } = makeCtx();
    const tools = toolsByName(ctx);
    const reuse = await tools.generate_music.handler({ prompt: 'warm lo-fi bed' }, {});
    expect(reuse.content[0].text).toContain('- library:music/lofi-warm.mp3 (audio, 57.05 s, imported)');
    expect(reuse.content[0].text).toContain('call generate_music again with force: true');
    expect(reuse.content[0].text).not.toContain('whoosh');
    expect(generateAudioAsset).not.toHaveBeenCalled();

    await tools.generate_music.handler({ prompt: 'warm lo-fi bed', durationSeconds: 90 }, {});
    expect(generateAudioAsset).toHaveBeenCalledTimes(1);

    loadIndex.mockClear();
    await tools.generate_music.handler({ compositionPlan: { sections: [{ name: 'a', durationSec: 10 }] } }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
  });
});
