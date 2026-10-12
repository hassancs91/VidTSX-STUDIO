import { describe, expect, it } from 'vitest';
import { buildBuilderSystemPrompt, BUDGET_ROUNDS } from './builder-prompt';
import { BUILDER_LIBRARIES, isBuilderLibrary } from '../../../shared/tsx-engine/builder-libraries';

describe('buildBuilderSystemPrompt', () => {
  it('states the look budget for the run', () => {
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [] })).toContain(`CRAFT: ${BUDGET_ROUNDS.craft} look rounds`);
    expect(buildBuilderSystemPrompt({ budget: 'quick', packs: [] })).toContain('QUICK: 1 look round (');
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [] })).toContain('finish is refused before round 4');
  });

  it("states an edit's own finish floor", () => {
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [], minRounds: 1 })).toContain('finish is refused before round 1');
  });

  it('appends craft packs verbatim, in order, and is stable for the prompt cache', () => {
    const packs = [
      { name: 'a', body: 'FIRST BODY' },
      { name: 'b', body: 'SECOND BODY' },
    ];
    const prompt = buildBuilderSystemPrompt({ budget: 'standard', packs });
    expect(prompt.indexOf('<pack name="a">')).toBeLessThan(prompt.indexOf('<pack name="b">'));
    expect(prompt).toContain('FIRST BODY');
    expect(buildBuilderSystemPrompt({ budget: 'standard', packs })).toBe(prompt);
  });

  it('says finish enforces the phone view and the final seam', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    expect(prompt).toContain('`finish` enforces both');
    expect(prompt).toContain('`loop_seam` AFTER your last change');
  });

  it('defines numbers as ink as countable marks, and a chart as not ink', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'craft', packs: [] });
    expect(prompt).toContain('Numbers as ink means COUNTABLE marks at true scale');
    expect(prompt).toContain('a chart, not ink');
    expect(prompt).toContain('A chart with a face added is still a chart.');
  });

  it('teaches 3D craft after the catalogue: frame-driven, the lab post order, nothing that loads a file', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    const block = prompt.slice(prompt.indexOf('## 3D'));
    expect(prompt.indexOf('## 3D')).toBeGreaterThan(prompt.indexOf('## Libraries'));
    expect(block).toContain('`<ThreeCanvas width={width} height={height}>` from @remotion/three');
    expect(block).toContain("never useFrame's clock");
    expect(block).toContain('`<EffectComposer multisampling={0}>` in this order: DepthOfField → N8AO → Bloom / ToneMapping / Vignette → SMAA last');
    expect(block).toContain('Give the Canvas `camera` prop fixed values only');
    expect(block).toContain("Never postprocessing's `<Noise>`");
    expect(block).toContain('no useGLTF, useTexture, loaders, `<Environment>`');
    // The 3D block comes before the budget line, so the cached prompt prefix is the same for every budget.
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [] }).indexOf('## 3D')).toBe(prompt.indexOf('## 3D'));
  });

  it('promises only packages the bundle step can inline, from the one library list', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    const libraries = prompt.slice(prompt.indexOf('## Libraries'));
    const promised = [...libraries.matchAll(/^- `([^`]+)`: /gm)].map((m) => m[1]);
    expect(promised.length).toBe(BUILDER_LIBRARIES.length);
    for (const name of promised) expect(isBuilderLibrary(name), name).toBe(true);
    expect(prompt).not.toMatch(/\btone\b/);
    expect(prompt).toContain('are refused: every change comes from `useCurrentFrame()`');
  });
});
