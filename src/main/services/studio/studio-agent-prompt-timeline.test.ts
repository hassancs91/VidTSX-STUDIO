// Assistant timeline read §7 / §8.1 6 — the prompt pins: get_timeline's
// TOOL_LINES line (exact, right before insert_asset's) and STUDIO_TOOL_IDS
// (the 29 ids of 0df9e9c in order, then 'get_timeline' — append-only).
import { describe, it, expect, vi } from 'vitest';
import { TOOL_LINES } from './studio-agent-prompt-tools';
import { buildAgentSystemPrompt, type BuildAgentPromptInput } from './studio-agent-prompt';
import { formatMasterCutsLine } from './agent-tools/timeline-listing';
import { summarizeMasterCuts } from '../../../shared/studio/timeline-cuts';

// flow-tools is the one group whose graph reaches `stream/promises` (zip-reader,
// project-package-zip) — that resolution fails in a node_modules-less
// worktree (ruling LS-r1c). The ids list does not depend on it.
vi.mock('./agent-tools/flow-tools', () => ({ buildFlowTools: () => [] }));

const { STUDIO_TOOL_IDS } = await import('./agent-tools/index');

const GET_TIMELINE_LINE =
  '- `get_timeline(fromSec?, toSec?)` — the timeline as it stands: every lane\'s clips in order (timeline start–end, the source span, the asset or shot), the master track\'s cuts numbered from 1 in timeline order, and gaps. Read it before placing anything relative to the edit ("at the first cut", "after the intro"). A long timeline comes back capped — pass `fromSec` / `toSec` for the next part (cut numbers stay counted from the start).';

const IDS_AT_0DF9E9C = [
  'get_transcript', 'propose_cuts', 'list_shots', 'generate_tsx_shot', 'propose_shots', 'generate_image',
  'remove_background', 'capture_webpage', 'capture_scripted', 'propose_memory', 'propose_style_promotion',
  'transcribe_asset', 'run_auto_cut', 'generate_video', 'insert_asset', 'list_assets', 'get_brand',
  'set_captions', 'accept_proposal', 'export_project', 'get_script', 'propose_vocabulary', 'get_preset',
  'propose_preset_update', 'generate_sfx', 'generate_music', 'run_flow', 'list_notes', 'read_note',
];

describe('prompt pins — get_timeline', () => {
  it('TOOL_LINES has the get_timeline line exactly, immediately before the insert_asset line', () => {
    const at = TOOL_LINES.indexOf(GET_TIMELINE_LINE);
    expect(at).toBeGreaterThan(0);
    expect(TOOL_LINES[at + 1].startsWith('- `insert_asset(')).toBe(true);
  });

  it('STUDIO_TOOL_IDS = the 29 ids of 0df9e9c in order, then get_timeline', () => {
    expect(IDS_AT_0DF9E9C).toHaveLength(29);
    expect([...STUDIO_TOOL_IDS]).toEqual([...IDS_AT_0DF9E9C, 'get_timeline']);
  });
});

// §4 / §8.1 3 — the cuts line in "State of the edit".
const cutsEvery2s = (k: number): number[] => Array.from({ length: k }, (_, i) => (i + 1) * 2);

describe('the cuts line (formatMasterCutsLine)', () => {
  it('absent, or 0 clips → no line', () => {
    expect(formatMasterCutsLine(undefined)).toBeUndefined();
    expect(formatMasterCutsLine({ trackName: 'V1', clipCount: 0, gapCount: 0, cuts: [] })).toBeUndefined();
  });

  it('1 clip, 0 cuts', () => {
    expect(formatMasterCutsLine({ trackName: 'V1', clipCount: 1, gapCount: 0, cuts: [] })).toBe(
      '- V1 (master track): 1 clip · no cuts.',
    );
  });

  it('2 clips, 1 cut — the 2-clip project through the shared summary', () => {
    const summary = summarizeMasterCuts({
      tracks: [
        {
          id: 'v1', kind: 'video', name: 'V1',
          clips: [
            { id: 'e3v-c1', kind: 'video', assetId: 'e3v', timelineStart: 0, duration: 3, sourceIn: 0 },
            { id: 'e3v-c2', kind: 'video', assetId: 'e3v', timelineStart: 3, duration: 3, sourceIn: 4 },
          ],
        },
        { id: 'a1', kind: 'audio', name: 'A1', clips: [] },
      ],
    });
    expect(formatMasterCutsLine(summary)).toBe('- V1 (master track): 2 clips · 1 cut — cut 1 at 0:03.00.');
  });

  it('exactly 5 cuts → all five', () => {
    expect(formatMasterCutsLine({ trackName: 'V1', clipCount: 6, gapCount: 0, cuts: cutsEvery2s(5) })).toBe(
      '- V1 (master track): 6 clips · 5 cuts — cut 1 at 0:02.00, cut 2 at 0:04.00, cut 3 at 0:06.00, cut 4 at 0:08.00, cut 5 at 0:10.00.',
    );
  });

  it('6 cuts → the first five, "+1 more"', () => {
    expect(formatMasterCutsLine({ trackName: 'V1', clipCount: 7, gapCount: 0, cuts: cutsEvery2s(6) })).toBe(
      '- V1 (master track): 7 clips · 6 cuts — cut 1 at 0:02.00, cut 2 at 0:04.00, cut 3 at 0:06.00, cut 4 at 0:08.00, cut 5 at 0:10.00, +1 more (get_timeline lists them).',
    );
  });

  it('with gaps (1 and 2)', () => {
    expect(formatMasterCutsLine({ trackName: 'A1', clipCount: 3, gapCount: 1, cuts: [5.5] })).toBe(
      '- A1 (master track): 3 clips · 1 gap · 1 cut — cut 1 at 0:05.50.',
    );
    expect(formatMasterCutsLine({ trackName: 'V2', clipCount: 3, gapCount: 2, cuts: [] })).toBe(
      '- V2 (master track): 3 clips · 2 gaps · no cuts.',
    );
  });
});

describe('buildAgentSystemPrompt — the cuts line sits right after "- Timeline: …"', () => {
  const base: BuildAgentPromptInput = {
    projectName: 'e3v-whoosh', assets: [], shots: [], toolsAvailable: true, reviewOpen: false, timelineDurationSeconds: 6,
  };
  const lineAfterTimeline = (prompt: string): string => {
    const lines = prompt.split('\n');
    const at = lines.indexOf('- Timeline: 0:06 long.');
    expect(at).toBeGreaterThan(0);
    return lines[at + 1];
  };

  it('2 clips · 1 cut', () => {
    const prompt = buildAgentSystemPrompt({ ...base, timelineCuts: { trackName: 'V1', clipCount: 2, gapCount: 0, cuts: [3] } });
    expect(lineAfterTimeline(prompt)).toBe('- V1 (master track): 2 clips · 1 cut — cut 1 at 0:03.00.');
  });

  it('field absent, or 0 clips → no line (Captions follows Timeline)', () => {
    expect(lineAfterTimeline(buildAgentSystemPrompt(base))).toBe('- Captions: none set.');
    const zero = buildAgentSystemPrompt({ ...base, timelineCuts: { trackName: 'V1', clipCount: 0, gapCount: 0, cuts: [] } });
    expect(lineAfterTimeline(zero)).toBe('- Captions: none set.');
    expect(zero).not.toContain('(master track)');
  });
});
