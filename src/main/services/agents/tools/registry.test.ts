import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AGENT_TOOL_IDS } from '../../../../shared/agents/tool-ids';
import { getNode, getTool, listNodeSpecs, listToolIds, selectTools } from './registry';
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

// W8 Stage 1 (flows plan §1.2): a tool with `ports` is also a node.
describe('registry ports and node specs', () => {
  const NODE_TOOLS = [
    'input_text',
    'input_image_library',
    'input_image_file',
    'input_video_file',
    'generate_text',
    'generate_image',
    'generate_video',
    'generate_composition',
    'edit_composition',
    'render_composition',
    // W8 Stage 3: generate_audio gained ports; seven product nodes joined.
    'generate_audio',
    'transcribe',
    'caption_video',
    'text_to_speech',
    'extract_frame',
    'trim_video',
    'concat_videos',
    'save_to_library',
    // W8 Stage 4: the agent node.
    'run_agent',
  ];

  it('the wave-1 node catalogue carries ports; agent-only tools do not', () => {
    for (const id of NODE_TOOLS) {
      expect(getNode(id)?.id, id).toBe(id);
    }
    for (const id of ['write_document', 'ask_user', 'list_artifacts', 'get_brand', 'write_page']) {
      expect(getNode(id), id).toBeUndefined();
    }
  });

  it('every input port names a key of the tool schema, and every output a source', () => {
    for (const id of NODE_TOOLS) {
      const def = getNode(id);
      if (!def?.ports) throw new Error(`${id} has no ports`);
      const keys = Object.keys(def.schema);
      for (const port of def.ports.inputs) {
        expect(keys, `${id}.${port.id}`).toContain(port.argKey ?? port.id);
      }
      expect(def.ports.outputs.length).toBeGreaterThan(0);
      for (const port of def.ports.outputs) {
        expect(port.from ?? 'artifact').toMatch(/^(artifact|field:.+)$/);
      }
      expect(def.ports.label.length).toBeGreaterThan(0);
      // Config defaults must survive the schema (unknown keys are stripped, so
      // a default that is not a schema key would silently do nothing).
      const parsed = z.object(def.schema).partial().safeParse(def.ports.defaultConfig);
      expect(parsed.success, `${id} defaultConfig`).toBe(true);
    }
  });

  it('listNodeSpecs is serialisable and marks unmet gates', () => {
    const specs = listNodeSpecs(NONE);
    expect(specs.map((s) => s.id).sort()).toEqual([...NODE_TOOLS].sort());
    expect(JSON.parse(JSON.stringify(specs))).toEqual(specs);
    const image = specs.find((s) => s.id === 'generate_image');
    expect(image).toMatchObject({ needs: ['image-provider'], available: false, category: 'image' });
    const text = specs.find((s) => s.id === 'input_text');
    expect(text?.needs).toBeUndefined();
    expect(text?.available).toBeUndefined();
    expect(listNodeSpecs(ALL).find((s) => s.id === 'generate_video')?.available).toBe(true);
  });

  it('generate_video is priced with a per-second hint from the fal catalog', () => {
    const video = listNodeSpecs(ALL).find((s) => s.id === 'generate_video');
    expect(video?.priced).toBe(true);
    expect(video?.priceHint).toMatch(/\$\d/);
    expect(video?.priceHint).toContain('/s');
    expect(listNodeSpecs(ALL).find((s) => s.id === 'generate_image')?.priced).toBeUndefined();
  });

  it('each node has exactly one primary output the canvas can derive sinks from', () => {
    const first = Object.fromEntries(listNodeSpecs(ALL).map((s) => [s.id, s.outputs[0]?.id]));
    expect(first).toMatchObject({
      input_text: 'text',
      input_image_library: 'image',
      input_image_file: 'image',
      input_video_file: 'video',
      generate_text: 'text',
      generate_image: 'image',
      generate_video: 'video',
      generate_composition: 'composition',
      edit_composition: 'composition',
      render_composition: 'video',
    });
  });
});
