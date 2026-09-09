import { describe, expect, it } from 'vitest';
import { buildTsxSystemPrompt, buildVerifyPrompt } from './prompt-builder';

// docs/v1-completion-plan.md §0 decision 7 / W1 acceptance row 4: the brand
// contract the Creator injects as `extraInstructions` must reach BOTH
// pipelines, not only the 2D one.
const BRAND = [
  'Brand "Acme" (MANDATORY styling): every color and font comes from the brand.',
  'Colors — primary #ff0055, secondary #00ffaa, background #101010, text #fafafa, accent #ffcc00.',
  'Fonts — display (headings/numbers): "Space Grotesk"; body: "Inter".',
].join('\n');

describe('buildTsxSystemPrompt — brand instructions reach every pipeline', () => {
  it('appends extraInstructions to the 2D generate prompt', () => {
    const prompt = buildTsxSystemPrompt({ extraInstructions: BRAND, fps: 30 }, '2d');
    expect(prompt).toContain('Brand "Acme"');
    expect(prompt).toContain('#ff0055');
    expect(prompt).toContain('Space Grotesk');
  });

  it('appends the same block to the 3D generate prompt', () => {
    const prompt = buildTsxSystemPrompt({ extraInstructions: BRAND, fps: 30 }, '3d');
    expect(prompt).toContain('Brand "Acme"');
    expect(prompt).toContain('#ff0055');
    expect(prompt).toContain('Space Grotesk');
  });

  it('leaves both prompts brand-free when nothing is given', () => {
    expect(buildTsxSystemPrompt({ fps: 30 }, '2d')).not.toContain('Brand "');
    expect(buildTsxSystemPrompt({ fps: 30 }, '3d')).not.toContain('Brand "');
  });

  it('the 3D prompt is the 3D one, not the 2D one with a brand appended', () => {
    const two = buildTsxSystemPrompt({ extraInstructions: BRAND }, '2d');
    const three = buildTsxSystemPrompt({ extraInstructions: BRAND }, '3d');
    expect(three).not.toBe(two);
    expect(three.toLowerCase()).toContain('three');
  });

  it('verify prompts exist for both modes', () => {
    expect(buildVerifyPrompt('2d', { extraInstructions: BRAND })).toBeTruthy();
    expect(buildVerifyPrompt('3d', { extraInstructions: BRAND })).toBeTruthy();
  });
});
