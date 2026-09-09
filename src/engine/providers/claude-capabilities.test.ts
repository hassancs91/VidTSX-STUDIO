import { describe, expect, it } from 'vitest';
import {
  requiresExplicitThinkingDisplay,
  resolveEffort,
  supportsAdaptiveThinking,
  supportsEffort,
  supportsMax,
  supportsXhigh,
} from './claude-capabilities';

describe('claude-capabilities — the Claude 5 surface (W1)', () => {
  it.each(['claude-opus-5', 'claude-sonnet-5', 'claude-fable-5-1', 'claude-opus-4-8'])(
    '%s takes adaptive thinking, effort up to max, and needs explicit display',
    (model) => {
      expect(supportsAdaptiveThinking(model)).toBe(true);
      expect(supportsEffort(model)).toBe(true);
      expect(supportsXhigh(model)).toBe(true);
      expect(supportsMax(model)).toBe(true);
      expect(requiresExplicitThinkingDisplay(model)).toBe(true);
      expect(resolveEffort(model, 'xhigh')).toBe('xhigh');
    },
  );

  it('keeps the 4.6 rows: adaptive + max, but xhigh degrades to high', () => {
    expect(supportsAdaptiveThinking('claude-sonnet-4-6')).toBe(true);
    expect(supportsXhigh('claude-sonnet-4-6')).toBe(false);
    expect(resolveEffort('claude-sonnet-4-6', 'xhigh')).toBe('high');
    expect(requiresExplicitThinkingDisplay('claude-sonnet-4-6')).toBe(false);
  });

  it('treats OpenRouter dotted ids like the hyphenated first-party ids', () => {
    expect(supportsAdaptiveThinking('anthropic/claude-opus-4.8')).toBe(true);
    expect(supportsXhigh('anthropic/claude-sonnet-5')).toBe(true);
    expect(supportsAdaptiveThinking('anthropic/claude-sonnet-4.6')).toBe(true);
    expect(supportsXhigh('anthropic/claude-sonnet-4.6')).toBe(false);
  });

  it('drops thinking + effort on non-Claude ids routed through the SDK', () => {
    for (const model of ['MiniMax-M3', 'kimi-k3', 'openai/gpt-5.5', 'claude-haiku-4-5-20251001']) {
      expect(supportsAdaptiveThinking(model), model).toBe(false);
      expect(resolveEffort(model, 'high'), model).toBeUndefined();
    }
  });
});
