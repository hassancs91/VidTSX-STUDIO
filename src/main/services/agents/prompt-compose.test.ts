import { describe, it, expect } from 'vitest';
import type { StarterTree } from '../../../shared/agents/starter';
import { composeAgentSystemPrompt } from './prompt-compose';

const skills = [
  { id: 'social-motion', name: 'Social Motion', description: 'timing', body: 'SKILL BODY' },
];

const tree: StarterTree = {
  entry: 'goal',
  nodes: {
    goal: {
      question: 'What kind of post?',
      select: 'one',
      options: [{ id: 'promo', label: 'Promote a product', next: 'brief' }],
      allowOther: true,
      otherNext: 'brief',
    },
    brief: { question: 'What is it about?', text: true, next: '$end' },
  },
  opening: 'Make a {{goal}} post about {{brief}}',
};

describe('composeAgentSystemPrompt', () => {
  it('is just AGENT.md when there is nothing else', () => {
    expect(composeAgentSystemPrompt({ promptBody: 'BODY', toolsAvailable: true })).toBe('BODY');
  });

  it('orders AGENT.md, skills, starter answers, availability, then memory', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      skills,
      starterAnswers: { goal: { ids: ['promo'] }, brief: { text: 'a newsletter launch' } },
      starterTree: tree,
      unavailableTools: ['generate_image'],
      toolsAvailable: true,
      memoryBlock: 'MEMORY BLOCK',
    });
    const order = [
      'BODY',
      '## Skill: Social Motion',
      '## Starter answers',
      '## Tool availability',
      'MEMORY BLOCK',
    ].map((needle) => composed.indexOf(needle));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps memory LAST, so editing it never rewrites the skill text', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      skills,
      toolsAvailable: true,
      memoryBlock: 'MEMORY BLOCK',
    });
    expect(composed.endsWith('MEMORY BLOCK')).toBe(true);
  });

  it('renders starter answers as their labels, and $other as the typed text', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      starterAnswers: { goal: { ids: ['$other'], text: 'a recruiting post' } },
      starterTree: tree,
      toolsAvailable: true,
    });
    expect(composed).toContain('- What kind of post? a recruiting post');
  });

  it('marks partial starter answers, so a skipped tree is not read as complete', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      starterAnswers: { goal: { ids: ['promo'] } },
      starterTree: tree,
      toolsAvailable: true,
    });
    expect(composed).toContain('## Starter answers (partial');
  });

  it('names the tool-capable providers when the session provider cannot run tools', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      toolsAvailable: false,
      toolCapableProviders: ['Claude subscription', 'OpenRouter'],
    });
    expect(composed).toContain('cannot run tools');
    expect(composed).toContain('OpenRouter');
  });

  it('never puts the artifact list in the prompt — there is no way to pass one', () => {
    const composed = composeAgentSystemPrompt({
      promptBody: 'BODY',
      skills,
      toolsAvailable: true,
    });
    expect(composed).not.toContain('artifact');
  });
});
