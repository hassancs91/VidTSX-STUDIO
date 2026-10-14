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

  it('says finish enforces a look at the final build, the phone view, the final seam and, on physics, purity', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    expect(prompt).toContain('`finish` enforces them all');
    expect(prompt).toContain('the last look showed exactly the build you are finishing');
    expect(prompt).toContain('once the look budget is spent, a look at a changed build is still allowed');
    expect(prompt).toContain('on a physics piece the last purity_check measured exactly that build and said PURE');
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
    expect(block).toContain('load through `@vidtsx/three-assets`');
    expect(block).toContain("never drei's `<Environment preset>`, `<Text>` / `<Text3D>`");
    // The 3D block comes before the budget line, so the cached prompt prefix is the same for every budget.
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [] }).indexOf('## 3D')).toBe(prompt.indexOf('## 3D'));
  });

  it('teaches physics after the 3D block: every engine steps through @vidtsx/sim, then purity_check', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    const block = prompt.slice(prompt.indexOf('## Physics'));
    expect(prompt.indexOf('## Physics')).toBeGreaterThan(prompt.indexOf('## 3D'));
    expect(block).toContain("Step every simulation through `useSimulation` from `@vidtsx/sim`, never on your own");
    expect(block).toContain("import { useSimulation } from '@vidtsx/sim';");
    expect(block).toContain('`init: () => RAPIER.init()`');
    expect(block).toContain("Never matter's Runner, cannon's fixedStep, or a step size from a clock");
    expect(block).toContain('never the bodies or the world');
    // P2 part 3 smoke: a spawn keyed by frame alone fired once per substep.
    expect(block).toContain('`if (frame === 45 && substep === 0) body.applyImpulse(…)`');
    expect(block).toContain('`purity_check` after your last change');
    expect(prompt).toContain('- `purity_check` — renders frames in order in one page and alone in fresh pages');
    // Before the budget line, like the 3D block: one cached prefix for every budget.
    expect(buildBuilderSystemPrompt({ budget: 'craft', packs: [] }).indexOf('## Physics')).toBe(prompt.indexOf('## Physics'));
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
