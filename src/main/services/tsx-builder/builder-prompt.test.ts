import { describe, expect, it } from 'vitest';
import { buildBuilderSystemPrompt, BUDGET_ROUNDS } from './builder-prompt';

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

  it('promises only packages the bundle step can inline', () => {
    const prompt = buildBuilderSystemPrompt({ budget: 'quick', packs: [] });
    expect(prompt).not.toMatch(/\btone\b/);
    expect(prompt).not.toMatch(/[`'"]three[`'"/]/);
    expect(prompt).toContain('@remotion/google-fonts');
  });
});
