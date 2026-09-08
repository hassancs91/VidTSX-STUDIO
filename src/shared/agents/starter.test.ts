import { describe, it, expect } from 'vitest';
import {
  nextNode,
  renderOpening,
  validateStarter,
  type StarterAnswer,
  type StarterTree,
} from './starter';

const tree = (overrides: Partial<StarterTree> = {}): StarterTree => ({
  entry: 'goal',
  nodes: {
    goal: {
      question: 'What kind of post?',
      select: 'one',
      options: [
        { id: 'promo', label: 'Promo', next: 'platform' },
        { id: 'tip', label: 'Tip', next: 'platform' },
      ],
      allowOther: true,
      otherNext: 'platform',
    },
    platform: {
      question: 'Where?',
      select: 'one',
      options: [{ id: '9:16', label: 'Reels', next: 'brief' }],
    },
    brief: { question: 'About what?', text: true, multiline: true, next: '$end' },
  },
  opening: 'Make a {{platform}} {{goal}} post about: {{brief}}',
  ...overrides,
});

describe('validateStarter', () => {
  it('accepts the plan §1.1 example shape', () => {
    expect(validateStarter(tree())).toEqual([]);
  });

  it('rejects an entry that is not a node', () => {
    expect(validateStarter(tree({ entry: 'nope' }))).toEqual(['starter.entry "nope" is not a node']);
  });

  it('rejects a next that names no node', () => {
    const t = tree();
    t.nodes.platform = {
      question: 'Where?',
      select: 'one',
      options: [{ id: '9:16', label: 'Reels', next: 'missing' }],
    };
    expect(validateStarter(t).join(' ')).toContain('unknown node "missing"');
  });

  it('rejects a cycle', () => {
    const t = tree();
    t.nodes.brief = { question: 'About what?', text: true, next: 'goal' };
    expect(validateStarter(t).join(' ')).toContain('cycle');
  });

  it('requires $end to be reachable', () => {
    const t: StarterTree = {
      entry: 'a',
      nodes: {
        a: { question: 'A?', select: 'one', options: [{ id: 'x', label: 'X', next: 'b' }] },
        b: { question: 'B?', select: 'one', options: [{ id: 'y', label: 'Y', next: 'b' }] },
      },
      opening: 'go',
    };
    expect(validateStarter(t).join(' ')).toMatch(/cycle|never reaches/);
  });

  it('flags unreachable nodes', () => {
    const t = tree();
    t.nodes.orphan = { question: 'Orphan?', text: true, next: '$end' };
    expect(validateStarter(t).join(' ')).toContain('"orphan" is unreachable');
  });

  it('rejects bad node ids, empty and oversized option lists', () => {
    const t = tree();
    t.nodes.Bad_Node = { question: 'X?', text: true, next: '$end' };
    t.nodes.goal = { question: 'Q?', select: 'one', options: [] };
    const found = validateStarter(t).join(' ');
    expect(found).toContain('"Bad_Node" must match');
    expect(found).toContain('has no options');
  });

  it('requires a node-level next on select:"many"', () => {
    const t = tree();
    t.nodes.platform = {
      question: 'Where?',
      select: 'many',
      options: [{ id: '9:16', label: 'Reels', next: 'brief' }],
    };
    expect(validateStarter(t).join(' ')).toContain('select:"many" and needs a node-level next');
  });

  it('checks every {{ref}} in the opening template', () => {
    expect(validateStarter(tree({ opening: 'A {{ghost}} post' })).join(' ')).toContain(
      'references "{{ghost}}"',
    );
  });
});

describe('nextNode', () => {
  it('follows the chosen option branch', () => {
    expect(nextNode(tree(), 'goal', { ids: ['promo'] })).toBe('platform');
  });

  it('sends the "Other…" path to otherNext', () => {
    expect(nextNode(tree(), 'goal', { ids: ['$other'], text: 'a recap' })).toBe('platform');
  });

  it('falls back to the node next when otherNext is absent', () => {
    const t = tree();
    t.nodes.goal = {
      question: 'What kind of post?',
      select: 'one',
      options: [{ id: 'promo', label: 'Promo', next: 'platform' }],
      allowOther: true,
      next: 'brief',
    };
    expect(nextNode(t, 'goal', { ids: ['$other'], text: 'x' })).toBe('brief');
  });

  it('uses the node-level next for select:"many", whatever was ticked', () => {
    const t = tree();
    t.nodes.platform = {
      question: 'Where?',
      select: 'many',
      options: [
        { id: '9:16', label: 'Reels', next: '$end' },
        { id: '1:1', label: 'Feed', next: '$end' },
      ],
      next: 'brief',
    };
    expect(nextNode(t, 'platform', { ids: ['9:16', '1:1'] })).toBe('brief');
  });

  it('ends the tree from a text node', () => {
    expect(nextNode(tree(), 'brief', { text: 'a launch' })).toBe('$end');
  });

  it('does not dead-end on an unanswered or unknown choice', () => {
    // "Skip and chat" leaves exactly this: a node with no answer.
    expect(nextNode(tree(), 'platform', {})).toBe('$end');
    expect(nextNode(tree(), 'goal', { ids: ['nope'] })).toBe('$end');
  });

  it('returns null for a node the tree does not have', () => {
    // A session whose agent was updated under it.
    expect(nextNode(tree(), 'gone', {})).toBeNull();
  });
});

describe('renderOpening', () => {
  const answers: Record<string, StarterAnswer> = {
    goal: { ids: ['promo'] },
    platform: { ids: ['9:16'] },
    brief: { text: '  the newsletter launch  ' },
  };

  it('resolves refs to labels and typed text', () => {
    expect(renderOpening(tree(), answers)).toBe(
      'Make a Reels Promo post about: the newsletter launch',
    );
  });

  it('renders the typed text for an "Other…" answer', () => {
    expect(renderOpening(tree(), { ...answers, goal: { ids: ['$other'], text: 'a recap' } })).toBe(
      'Make a Reels a recap post about: the newsletter launch',
    );
  });

  it('joins a many-select answer', () => {
    const t = tree();
    t.nodes.platform = {
      question: 'Where?',
      select: 'many',
      options: [
        { id: '9:16', label: 'Reels', next: '$end' },
        { id: '1:1', label: 'Feed', next: '$end' },
      ],
      next: 'brief',
    };
    expect(renderOpening(t, { ...answers, platform: { ids: ['9:16', '1:1'] } })).toContain(
      'Reels, Feed',
    );
  });

  it('reads as a sentence when the user skipped ahead', () => {
    // Partial answers are the normal case — every step offers "Skip and chat" —
    // so a half-filled template must never show the user a raw {{ref}}.
    expect(renderOpening(tree(), { goal: { ids: ['promo'] } })).toBe('Make a Promo post about:');
    expect(renderOpening(tree(), {})).toBe('Make a post about:');
  });
});
