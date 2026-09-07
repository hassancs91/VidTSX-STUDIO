import { describe, it, expect } from 'vitest';
import { getTool, listToolIds, selectTools } from './registry';
import { sdkToolName } from './tool-server';

const ALL = { imageProvider: true, videoProvider: true };
const NONE = { imageProvider: false, videoProvider: false };

describe('tool registry', () => {
  it('registers the wave-1 set', () => {
    expect(listToolIds().sort()).toEqual(
      [
        'ask_user',
        'edit_composition',
        'generate_composition',
        'generate_image',
        'generate_video',
        'list_artifacts',
        'render_composition',
        'write_document',
      ].sort(),
    );
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
    const selection = selectTools(['generate_image', 'generate_video', 'write_document'], NONE);
    expect(selection.tools.map((t) => t.id)).toEqual([
      'generate_image',
      'generate_video',
      'write_document',
    ]);
    expect(selection.unavailable).toEqual([
      { id: 'generate_image', needs: 'image-provider' },
      { id: 'generate_video', needs: 'video-provider' },
    ]);
    expect(selectTools(['generate_image', 'generate_video'], ALL).unavailable).toEqual([]);
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
