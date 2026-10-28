import fs from 'fs/promises';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, formatShotLine } from './studio-agent-prompt';
import { composePresetBlock } from './agent-preset-prompt';
import type { StudioShot } from '@shared/types/studio';
import type { StudioPresetEntry } from '@shared/types/studio-preset';

function shot(overrides: Partial<StudioShot> = {}): StudioShot {
  return {
    id: 'intro-title',
    name: 'Intro title',
    kind: 'title',
    createdAt: '2026-08-19T00:00:00.000Z',
    activeVersion: 1,
    status: 'ready',
    config: { durationInFrames: 150, fps: 30, width: 1920, height: 1080 },
    anchor: { assetId: 'asset-1', sourceStart: 2.26, sourceEnd: 7.5 },
    ...overrides,
  };
}

describe('formatShotLine', () => {
  it('renders id, kind, duration, version, status, and anchor', () => {
    const line = formatShotLine(shot());
    expect(line).toContain('intro-title');
    expect(line).toContain('"Intro title"');
    expect(line).toContain('title, 5.0 s, v1, ready');
    expect(line).toContain('anchored to asset-1 2.3–7.5s');
  });

  it('marks unanchored shots and unknown durations', () => {
    const line = formatShotLine(
      shot({ config: undefined, anchor: undefined, kind: 'cutaway' }),
    );
    expect(line).toContain('unknown length');
    expect(line).toContain('unanchored');
  });

  it('marks user-imported shots', () => {
    expect(formatShotLine(shot({ origin: { by: 'user' } }))).toContain('imported');
    expect(formatShotLine(shot({ origin: { by: 'agent' } }))).not.toContain('imported');
  });
});

describe('buildAgentSystemPrompt — shot pool section', () => {
  const base = {
    projectName: 'Test',
    assets: [],
    toolsAvailable: true,
    reviewOpen: false,
  };

  it('lists pool shots with the persistence guidance', () => {
    const prompt = buildAgentSystemPrompt({ ...base, shots: [shot()] });
    expect(prompt).toContain('## Shot pool');
    expect(prompt).toContain('intro-title');
    expect(prompt).toContain('persist across sessions');
    expect(prompt).toContain('list_shots');
  });

  it('shows the empty-pool placeholder when there are no shots', () => {
    const prompt = buildAgentSystemPrompt({ ...base, shots: [] });
    expect(prompt).toContain('(empty — no shots generated or imported yet)');
  });
});

describe('buildAgentSystemPrompt — run_auto_cut takes the project cut style (B2 fix round 1)', () => {
  const FORCED_STYLE = /run_auto_cut\(style:|style: *"(tight|natural|relaxed)"/;

  it('no aggressiveness → style mapping; omit `style` unless the user asked', () => {
    const prompt = buildAgentSystemPrompt({ projectName: 'T', assets: [], shots: [], toolsAvailable: true, reviewOpen: false });
    expect(prompt).not.toMatch(FORCED_STYLE);
    expect(prompt).not.toContain('light or normal');
    expect(prompt).toContain('an `auto_cut` step runs `run_auto_cut` WITHOUT `style`');
    expect(prompt).toContain('does not pick a style; pass `style` only when the user asked for one in this conversation');
  });

  it.each(['course-lesson', 'talking-head-short', 'youtube-long-form'])(
    'the shipped %s preset block forces no style either, and names its cut style source',
    async (id) => {
      const dir = path.resolve(process.cwd(), 'resources/presets', id);
      const json = JSON.parse(await fs.readFile(path.join(dir, 'preset.json'), 'utf-8')) as Omit<StudioPresetEntry, 'id' | 'body'>;
      const body = await fs.readFile(path.join(dir, 'PRESET.md'), 'utf-8');
      const { block } = composePresetBlock({ ...json, id, body });
      expect(block).toMatch(/\d\. auto_cut \((light|normal|aggressive)\)/);
      expect(block).toMatch(/Style knobs: pacing (tight|normal|relaxed)/);
      expect(block).not.toMatch(FORCED_STYLE);
    },
  );
});

describe('buildAgentSystemPrompt — reuse before generate: search the library before generating any sound (E3)', () => {
  const prompt = buildAgentSystemPrompt({ projectName: 'T', assets: [], shots: [], toolsAvailable: true, reviewOpen: false });

  it('list_assets is where a sound is looked up first', () => {
    expect(prompt).toContain(
      'For any SOUND (a whoosh, a hit, a chime, a music bed) search it first: `list_assets(scope: "library", kind: "audio", query: "whoosh")`',
    );
  });

  it('generate_sfx / generate_music say they check the library first and that `force` is the way past it', () => {
    expect(prompt).toContain('`generate_sfx(prompt, durationSeconds?, loop?, promptInfluence?, force?)`');
    expect(prompt).toContain('It checks the library FIRST: when sounds there match the prompt it returns the top three `library:<path>` refs instead of generating');
    expect(prompt).toContain('pass `force: true` only when none of them fits');
    expect(prompt).toContain('The same library check as generate_sfx (a bed shorter than the length you ask is not offered)');
  });

  it('the full-edit Sound step searches the library before generating, and library sounds need no provider', () => {
    expect(prompt).toContain('6. Sound: search the library before generating any sound — `list_assets(scope: "library", kind: "audio", query: …)`');
    expect(prompt).toContain('only when nothing fits, `generate_sfx`');
    expect(prompt).toContain('Library sounds need no provider; skip only the generation');
    expect(prompt).not.toContain('6. Sound: `generate_sfx` for a transition');
  });

  it('the preset mapping: an `sfx` / `music` step lists the library first', () => {
    expect(prompt).toContain('an `sfx` step means `list_assets(scope: "library", kind: "audio")` FIRST and a library sound that fits, else `generate_sfx`');
    expect(prompt).toContain('a `music` step the same — a library bed first, else `generate_music`');
    expect(prompt).not.toContain('an `sfx` step means `generate_sfx` + `insert_asset');
  });

  it('the miss rule (E-d15, fix round 3): a miss answers the closest library sounds; `force: true` is the only way to generate while the library scores', () => {
    expect(prompt).toContain('Even a sound the library lacks starts there: on a miss generate_sfx / generate_music answer the closest library sounds before anything is generated.');
    expect(prompt).toContain('When nothing matches well it STILL generates nothing: it answers the three closest library sounds — place one that fits, or call again with `force: true` to generate; it generates without `force` only when nothing in the library scores at all.');
    expect(prompt).toContain('and the same miss rule — the closest library beds instead of a new track, `force: true` to generate');
    expect(prompt).toContain('A miss answers the closest library sounds, not a new file — call again with `force: true` only when none of them fits either.');
    expect(prompt).toContain('on a miss either tool answers the closest library sounds instead of generating — `force: true` generates when none fits');
  });
});

describe('buildAgentSystemPrompt — W3 state block and workflows', () => {
  const base = {
    projectName: 'Test',
    assets: [],
    shots: [],
    toolsAvailable: true,
    reviewOpen: false,
  };

  it('describes an empty edit and names the end-to-end tools', () => {
    const prompt = buildAgentSystemPrompt(base);
    expect(prompt).toContain('## State of the edit');
    expect(prompt).toContain('- Timeline: empty.');
    expect(prompt).toContain('- Captions: none set.');
    expect(prompt).toContain('- Open proposal: none.');
    for (const id of [
      'transcribe_asset',
      'run_auto_cut',
      'generate_video',
      'insert_asset',
      'list_assets',
      'get_brand',
      'set_captions',
      'accept_proposal',
      'export_project',
    ]) {
      expect(prompt).toContain(`\`${id}(`);
    }
    expect(prompt).toContain('Workflow for "edit this video"');
    expect(prompt).toContain('[next:');
  });

  it('names the open proposal so accept_proposal can apply it', () => {
    const prompt = buildAgentSystemPrompt({
      ...base,
      reviewOpen: true,
      openProposal: { id: 'prop_1', kind: 'cut-plan', itemCount: 12, note: 'Auto Cut (tight)' },
      captions: { templateId: 'core/word-pop', enabled: true },
      timelineDurationSeconds: 125.4,
    });
    expect(prompt).toContain('- Timeline: 2:05 long.');
    expect(prompt).toContain('- Captions: on (template core/word-pop).');
    expect(prompt).toContain('Open proposal: id "prop_1" — 12 cut items ("Auto Cut (tight)")');
    expect(prompt).toContain('call `accept_proposal` with the open proposal\'s id');
  });

  it('injects the script opening and points at get_script for the rest (W4)', () => {
    const short = buildAgentSystemPrompt({ ...base, script: 'Welcome to VidTSX. Three takes follow.' });
    expect(short).toContain('## Script');
    expect(short).toContain('INTENDED FINAL READ (38 chars)');
    expect(short).toContain('It follows in full.');
    expect(short).toContain('Welcome to VidTSX. Three takes follow.');

    const long = buildAgentSystemPrompt({
      ...base,
      script: Array.from({ length: 500 }, (_, i) => `line${i}`).join(' '),
    });
    expect(long).toMatch(/call `get_script\(startChar: \d+\)` for the remaining \d+ chars/);
    expect(long).not.toContain('line499');
    expect(long).toContain('`get_script(');

    expect(buildAgentSystemPrompt(base)).toContain('(none — the Script tab is empty');
  });

  it('keeps the tool section out for chat-only providers', () => {
    const prompt = buildAgentSystemPrompt({ ...base, toolsAvailable: false });
    expect(prompt).toContain('## Tool availability');
    expect(prompt).not.toContain('transcribe_asset');
  });
});
