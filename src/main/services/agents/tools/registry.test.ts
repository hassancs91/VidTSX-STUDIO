import { describe, it, expect } from 'vitest';
import { AGENT_TOOL_IDS } from '../../../../shared/agents/tool-ids';
import { getTool, listToolIds, selectTools } from './registry';
import { sdkToolName } from './tool-server';

const ALL = { imageProvider: true, videoProvider: true, audioProvider: true };
const NONE = { imageProvider: false, videoProvider: false, audioProvider: false };

describe('tool registry', () => {
  // AGENT_TOOL_IDS is the bundleable copy of this list — `agent-pack --check`
  // and the renderer read it because reaching the registry means importing
  // every tool and, through them, Electron. This assertion is what stops the
  // two drifting.
  it('registers the wave-1 set, and it matches AGENT_TOOL_IDS', () => {
    expect(listToolIds().sort()).toEqual([...AGENT_TOOL_IDS].sort());
  });

  it('selects only what the manifest asked for, in manifest order', () => {
    const selection = selectTools(['ask_user', 'write_document'], ALL);
    expect(selection.tools.map((t) => t.id)).toEqual(['ask_user', 'write_document']);
    expect(selection.missing).toEqual([]);
  });

  it('reports ids that no longer exist instead of silently dropping them', () => {
    const selection = selectTools(['write_document', 'launch_missiles'], ALL);
    expect(selection.tools.map((t) => t.id)).toEqual(['write_document']);
    expect(selection.missing).toEqual(['launch_missiles']);
  });

  it('ignores a repeated id', () => {
    expect(selectTools(['ask_user', 'ask_user'], ALL).tools).toHaveLength(1);
  });

  it('keeps capability-gated tools but marks them unavailable (§1.8)', () => {
    const selection = selectTools(
      ['generate_image', 'generate_video', 'generate_audio', 'write_document'],
      NONE,
    );
    expect(selection.tools.map((t) => t.id)).toEqual([
      'generate_image',
      'generate_video',
      'generate_audio',
      'write_document',
    ]);
    expect(selection.unavailable).toEqual([
      { id: 'generate_image', needs: 'image-provider' },
      { id: 'generate_video', needs: 'video-provider' },
      { id: 'generate_audio', needs: 'audio-provider' },
    ]);
    expect(
      selectTools(['generate_image', 'generate_video', 'generate_audio'], ALL).unavailable,
    ).toEqual([]);
  });

  it('every registered tool has an id, a description and a schema', () => {
    for (const id of listToolIds()) {
      const def = getTool(id);
      expect(def).toBeDefined();
      expect(def?.id).toBe(id);
      expect((def?.description ?? '').length).toBeGreaterThan(20);
      expect(typeof def?.schema).toBe('object');
    }
  });

  it('names tools the way the SDK allowlist expects', () => {
    expect(sdkToolName('write_document')).toBe('mcp__vidtsx__write_document');
  });
});
