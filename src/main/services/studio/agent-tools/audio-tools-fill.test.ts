// E3 fix round 4 (E-d16 + E-d16a) — the answer-level recall fill through the REAL generate_sfx /
// generate_music handlers over the committed 51-clip catalog fixture (the real index's clips, verbatim):
// up to three labelled library sounds whenever any candidate scores — the confident matches first, then
// weak matches and closest candidates together by coverage (a closest before a weak match on a tie);
// "may have" when every shown match is weak; nothing generated, no provider check. The engine and the
// normalizer both live behind the mocked `generateAudioAsset`. Same mocks as audio-tools-miss.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StudioToolContext } from './types';
import { CORPUS_LIBRARY } from '../../library/sound-match-corpus.fixture';

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

function toolsByName(): Record<string, ToolLike> {
  const ctx = {
    req: { projectId: 'p1', assets: [], reviewOpen: false },
    signal: new AbortController().signal,
    emit: () => undefined,
    state: { proposalId: null, generatedShots: new Map(), importedAssets: new Map() },
  } as unknown as StudioToolContext;
  const out: Record<string, ToolLike> = {};
  for (const t of buildAudioTools(ctx) as unknown as ToolLike[]) out[t.name] = t;
  return out;
}

beforeEach(() => {
  hasAudioProvider.mockReset();
  generateAudioAsset.mockReset();
  importLibraryFile.mockReset();
  loadIndex.mockReset();
  hasAudioProvider.mockResolvedValue(false);
  generateAudioAsset.mockImplementation(async (req: { kind: string }) => ({
    relPath: `generated/${req.kind}-x.mp3`, kind: req.kind, durationSeconds: 2.973, description: 'x',
    providerId: 'elevenlabs', model: 'm', normalized: true, loudnessLufs: -20.01, peakDbfs: -8.2,
  }));
  importLibraryFile.mockResolvedValue({ id: 'asset-9', kind: 'audio', path: 'C:/lib/generated/x.mp3' });
  loadIndex.mockResolvedValue({ version: 1, rev: 2, entries: CORPUS_LIBRARY, tombstones: [] });
});

/** Each row as "<label> <clip id>", in the answer's order. */
function rowsOf(text: string): string[] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('- ['))
    .map((l) => /^- \[([a-z ]+)\] library:(?:sfx|music)\/([a-z0-9-]+)\.mp3 \(audio, /.exec(l))
    .map((m) => (m ? `${m[1]} ${m[2]}` : 'BAD ROW'));
}

function expectNothingGenerated(): void {
  expect(hasAudioProvider).not.toHaveBeenCalled();
  expect(generateAudioAsset).not.toHaveBeenCalled();
  expect(importLibraryFile).not.toHaveBeenCalled();
}

const SFX_HINT = (first: string): string =>
  `If one of them fits, place it with insert_asset(assetId: "library:sfx/${first}.mp3", lane: "audio", at: …) — a library ref works as the asset id. If none fits, call generate_sfx again with force: true to generate a new one.`;

describe('Studio audio tools — the answer-level recall fill (E3 fix round 4, E-d16 + E-d16a)', () => {
  it('F4 "a cracked screen": a weak match + the closest → three labelled rows, the "may have" wording, the right clip shown', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a cracked screen' }, {});
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(
      'The library may have a sound for "a cracked screen" — only 1 weak match, nothing confident; nothing was generated (no cost, no provider needed). The closest library sounds:',
    );
    expect(rowsOf(res.content[0].text)).toEqual(['weak match power-down', 'closest break-glass-crack', 'closest pop-reveal']);
    expect(lines[1]).toMatch(/^- \[weak match\] library:sfx\/power-down\.mp3 \(audio, [0-9.]+ s, imported\) — "/);
    expect(lines[4]).toBe(SFX_HINT('power-down'));
    expect(lines).toHaveLength(5);
    expect(res.content[0].text).not.toContain('The library already has');
    expect(res.isError).toBeUndefined();
    expectNothingGenerated();
  });

  it('F4 "a scribbled note": the closest pencil-scribble (0.30) goes BEFORE the weak chime-reward (0.30) on the tie', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a scribbled note' }, {});
    expect(rowsOf(res.content[0].text)).toEqual(['closest pencil-scribble', 'weak match chime-reward']);
    expect(res.content[0].text.startsWith('The library may have a sound for "a scribbled note" — only 1 weak match')).toBe(true);
    expect(res.content[0].text.endsWith(SFX_HINT('pencil-scribble'))).toBe(true);
    expectNothingGenerated();
  });

  it('E-d16a "a breaking screen": power-down (exactly 0.50) matched, then BOTH break clips — not the weak pop-reveal / scan-hum', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a breaking screen' }, {});
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(
      'The library already has 1 sound matching "a breaking screen" — nothing was generated (no cost, no provider needed). 3 shown: 1 matched, 2 closest:',
    );
    expect(rowsOf(res.content[0].text)).toEqual(['matched power-down', 'closest break-crash-digital', 'closest break-glass-crack']);
    expect(lines[4]).toBe(
      'Place the one that fits with insert_asset(assetId: "library:sfx/power-down.mp3", lane: "audio", at: …) — a library ref works as the asset id. Only if none of them fits, call generate_sfx again with force: true to generate a new one.',
    );
    expectNothingGenerated();
  });

  it('F3 "running water": stream-soft matched, the stem collision dash-zip only as `closest` (two rows, never padded)', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'running water' }, {});
    expect(rowsOf(res.content[0].text)).toEqual(['matched stream-soft', 'closest dash-zip']);
    expect(res.content[0].text.split('\n')[0]).toBe(
      'The library already has 1 sound matching "running water" — nothing was generated (no cost, no provider needed). 2 shown: 1 matched, 1 closest:',
    );
    expectNothingGenerated();
  });

  it('three confident matches → the old match header unchanged, three `matched` rows', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'an F major triad' }, {});
    expect(res.content[0].text.split('\n')[0]).toBe(
      'The library already has 3 sounds matching "an F major triad" — nothing was generated (no cost, no provider needed):',
    );
    expect(rowsOf(res.content[0].text).map((r) => r.split(' ')[0])).toEqual(['matched', 'matched', 'matched']);
    expect(res.content[0].text).toContain('Only if none of them fits, call generate_sfx again with force: true');
  });

  it('a pure miss keeps fix round 3\'s wording — the rows labelled `closest`', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a soft knocking' }, {});
    const lines = res.content[0].text.split('\n');
    expect(lines[0]).toBe(
      'No library sound matched "a soft knocking" well — nothing was generated (no cost, no provider needed). The closest library sounds:',
    );
    expect(rowsOf(res.content[0].text)).toEqual(['closest chess-piece-capture', 'closest knock-solid', 'closest chess-piece-thock']);
    expect(lines[4]).toBe(SFX_HINT('chess-piece-capture'));
    expectNothingGenerated();
  });

  it('a TRUE miss (nothing scores) generates without force; force: true generates without looking', async () => {
    hasAudioProvider.mockResolvedValue(true);
    const tools = toolsByName();
    const res = await tools.generate_sfx.handler({ prompt: 'a dog bark' }, {});
    expect(generateAudioAsset).toHaveBeenCalledWith(expect.objectContaining({ kind: 'sfx', prompt: 'a dog bark' }));
    expect(res.content[0].text).toContain('project asset id "asset-9"');

    loadIndex.mockClear();
    const forced = await tools.generate_sfx.handler({ prompt: 'a cracked screen', force: true }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
    expect(forced.content[0].text).toContain('project asset id "asset-9"');
  });

  it('E-d16b "a sparkling screen": the confident power-down covers only `screen` → the sparkle carriers go ahead of scan-hum (screen only)', async () => {
    const res = await toolsByName().generate_sfx.handler({ prompt: 'a sparkling screen' }, {});
    expect(res.content[0].text.split('\n')[0]).toBe(
      'The library already has 1 sound matching "a sparkling screen" — nothing was generated (no cost, no provider needed). 3 shown: 1 matched, 1 weak match, 1 closest:',
    );
    expect(rowsOf(res.content[0].text)).toEqual(['matched power-down', 'weak match pop-reveal', 'closest sparkle-soft']);
    expectNothingGenerated();
  });

  it('E-d16b "a whooshing screen": two whooshes beside power-down (pop-reveal / scan-hum only repeat `screen`); "a clicking screen" is the stated limit', async () => {
    const tools = toolsByName();
    const res = await tools.generate_sfx.handler({ prompt: 'a whooshing screen' }, {});
    expect(rowsOf(res.content[0].text)).toEqual(['matched power-down', 'closest whoosh-soft', 'closest whoosh-reverse']);
    expect(res.content[0].text.split('\n')[0]).toContain('3 shown: 1 matched, 2 closest:');
    // power-down's own description ("one soft click") covers `clicking`: no word is uncovered, E-d16a's order stands
    const click = await tools.generate_sfx.handler({ prompt: 'a clicking screen' }, {});
    expect(rowsOf(click.content[0].text)).toEqual(['matched power-down', 'weak match pop-reveal', 'weak match scan-hum']);
    expectNothingGenerated();
  });

  it('generate_music: the same fill (labelled), the length rule drops a short bed from it, a plan never looks, force generates', async () => {
    const tools = toolsByName();
    const res = await tools.generate_music.handler({ prompt: 'a pulsing bed' }, {});
    expect(rowsOf(res.content[0].text)).toEqual(['matched tech-pulse', 'closest lullaby-tender', 'closest ambient-pad']);
    expect(res.content[0].text).toContain('call generate_music again with force: true');
    expect(res.content[0].text).not.toContain('library:sfx/');

    const long = await tools.generate_music.handler({ prompt: 'a pulsing bed', durationSeconds: 60 }, {});
    expect(rowsOf(long.content[0].text)).toEqual(['matched tech-pulse', 'closest ambient-pad', 'closest cinematic-min']);

    const miss = await tools.generate_music.handler({ prompt: 'a warm bed for a cooking show' }, {});
    expect(miss.content[0].text.startsWith('No library sound matched "a warm bed for a cooking show" well')).toBe(true);
    expect(rowsOf(miss.content[0].text)[0]).toBe('closest lofi-warm');
    expectNothingGenerated();

    hasAudioProvider.mockResolvedValue(true);
    loadIndex.mockClear();
    await tools.generate_music.handler({ compositionPlan: { sections: [{ name: 'a', durationSec: 10 }] } }, {});
    await tools.generate_music.handler({ prompt: 'a pulsing bed', force: true }, {});
    expect(loadIndex).not.toHaveBeenCalled();
    expect(generateAudioAsset).toHaveBeenCalledTimes(2);
  });
});
