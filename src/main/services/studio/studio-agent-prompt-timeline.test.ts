// Assistant timeline read §7 / §8.1 6 — the prompt pins: get_timeline's
// TOOL_LINES line (exact, right before insert_asset's) and STUDIO_TOOL_IDS
// (the 29 ids of 0df9e9c in order, then 'get_timeline' — append-only).
import { describe, it, expect, vi } from 'vitest';
import { TOOL_LINES } from './studio-agent-prompt-tools';

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
