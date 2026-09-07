import { describe, it, expect } from 'vitest';
import { validateStarter, type StarterTree } from './starter';

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
