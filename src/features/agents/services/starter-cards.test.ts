import { describe, it, expect } from 'vitest';
import type { StarterTree } from '@shared/agents/starter';
import { validateStarter } from '@shared/agents/starter';
import {
  isEmptyStarterAnswers,
  starterTitle,
  needsOtherStep,
  starterAnswerFrom,
  starterInitialValues,
  starterRequest,
  stepsRemaining,
} from './starter-cards';

/** Motion Post's real tree, which is what Stage 5 drives the UI against. */
const tree: StarterTree = {
  entry: 'goal',
  nodes: {
    goal: {
      question: 'What kind of post?',
      select: 'one',
      options: [
        { id: 'promo', label: 'Promote a product or offer', next: 'platform' },
        { id: 'tip', label: 'Share a tip or insight', next: 'platform' },
      ],
      allowOther: true,
      otherNext: 'platform',
    },
    platform: {
      question: 'Where will it be posted?',
      hint: 'This sets the frame size.',
      select: 'one',
      options: [
        { id: '9:16', label: 'Reels / Shorts / TikTok', next: 'brief' },
        { id: '1:1', label: 'Instagram feed', next: 'brief' },
      ],
    },
    brief: {
      question: 'What is it about?',
      text: true,
      multiline: true,
      next: '$end',
    },
  },
  opening: 'Make a {{platform}} {{goal}} post about: {{brief}}',
};

describe('starter cards', () => {
  it('the tree it is driven against is valid', () => {
    expect(validateStarter(tree)).toEqual([]);
  });

  it('renders a select node as a pick card, with Other appended', () => {
    const request = starterRequest('goal', tree.nodes.goal, 'node');
    expect(request.payload.kind).toBe('pick');
    if (request.payload.kind !== 'pick') throw new Error('not a pick');
    expect(request.payload.select).toBe('one');
    expect(request.payload.candidates.map((c) => c.id)).toEqual(['promo', 'tip', '$other']);
  });

  it('omits Other when the node does not allow it', () => {
    const request = starterRequest('platform', tree.nodes.platform, 'node');
    if (request.payload.kind !== 'pick') throw new Error('not a pick');
    expect(request.payload.candidates.map((c) => c.id)).toEqual(['9:16', '1:1']);
  });

  it('renders a text node as a one-field form, multiline when asked', () => {
    const request = starterRequest('brief', tree.nodes.brief, 'node');
    if (request.payload.kind !== 'form') throw new Error('not a form');
    expect(request.payload.fields).toHaveLength(1);
    expect(request.payload.fields[0].id).toBe('brief');
    expect(request.payload.fields[0].kind).toBe('multiline');
  });

  it('renders the Other follow-up as a text form keyed by $other', () => {
    const request = starterRequest('goal', tree.nodes.goal, 'other');
    if (request.payload.kind !== 'form') throw new Error('not a form');
    expect(request.payload.title).toBe('What kind of post?');
    expect(request.payload.fields[0].id).toBe('$other');
    expect(request.payload.fields[0].kind).toBe('text');
  });

  it('carries no session id — the starter runs before the session exists', () => {
    expect(starterRequest('goal', tree.nodes.goal, 'node').sessionId).toBe('');
  });

  it('turns a pick reply into option ids', () => {
    const answer = starterAnswerFrom('goal', tree.nodes.goal, 'node', { tip: ['Share a tip'] }, undefined);
    expect(answer).toEqual({ ids: ['tip'] });
  });

  it('turns a text reply into text', () => {
    const answer = starterAnswerFrom('brief', tree.nodes.brief, 'node', { brief: ['A launch'] }, undefined);
    expect(answer).toEqual({ text: 'A launch' });
  });

  it('turns the Other follow-up into $other plus what was typed', () => {
    const answer = starterAnswerFrom('goal', tree.nodes.goal, 'other', { $other: ['A recap'] }, undefined);
    expect(answer).toEqual({ ids: ['$other'], text: 'A recap' });
  });

  it('drops typed text when the user comes back and picks a real option', () => {
    const prior = { ids: ['$other'], text: 'A recap' };
    const answer = starterAnswerFrom('goal', tree.nodes.goal, 'node', { promo: ['Promote'] }, prior);
    expect(answer).toEqual({ ids: ['promo'] });
  });

  it('keeps typed text when the user comes back and picks Other again', () => {
    const prior = { ids: ['$other'], text: 'A recap' };
    const answer = starterAnswerFrom('goal', tree.nodes.goal, 'node', { $other: ['Other'] }, prior);
    expect(answer).toEqual({ ids: ['$other'], text: 'A recap' });
  });

  it('only routes to the Other step for a node that allows it', () => {
    expect(needsOtherStep(tree.nodes.goal, 'node', { ids: ['$other'] })).toBe(true);
    expect(needsOtherStep(tree.nodes.goal, 'node', { ids: ['promo'] })).toBe(false);
    expect(needsOtherStep(tree.nodes.platform, 'node', { ids: ['$other'] })).toBe(false);
    // Never twice: the follow-up itself must not route back to itself.
    expect(needsOtherStep(tree.nodes.goal, 'other', { ids: ['$other'] })).toBe(false);
  });

  it('restores a previous answer for Back, keyed by option id', () => {
    expect(starterInitialValues('goal', tree.nodes.goal, 'node', { ids: ['tip'] })).toEqual({
      tip: ['Share a tip or insight'],
    });
    expect(starterInitialValues('brief', tree.nodes.brief, 'node', { text: 'A launch' })).toEqual({
      brief: ['A launch'],
    });
    expect(starterInitialValues('goal', tree.nodes.goal, 'other', { ids: ['$other'], text: 'A recap' })).toEqual({
      $other: ['A recap'],
    });
  });

  it('has nothing to restore for an unanswered step', () => {
    expect(starterInitialValues('goal', tree.nodes.goal, 'node', undefined)).toBeUndefined();
    expect(starterInitialValues('goal', tree.nodes.goal, 'node', { ids: [] })).toBeUndefined();
  });

  it('counts the steps left as the longest path to $end', () => {
    expect(stepsRemaining(tree, 'goal')).toBe(3);
    expect(stepsRemaining(tree, 'platform')).toBe(2);
    expect(stepsRemaining(tree, 'brief')).toBe(1);
    expect(stepsRemaining(tree, 'nope')).toBe(0);
  });

  it('names the session after the longest thing the user typed', () => {
    // §1.11 builds the library folder from the title at CREATION and never
    // moves it, so without this every starter session shares one folder.
    expect(
      starterTitle({ goal: { ids: ['tip'] }, brief: { text: '  Batching  your  camera roll ' } }),
    ).toBe('Batching your camera roll');
    expect(starterTitle({ a: { text: 'short' }, b: { text: 'much longer answer' } })).toBe(
      'much longer answer',
    );
    expect(starterTitle({ goal: { ids: ['tip'] } })).toBeUndefined();
    expect(starterTitle({})).toBeUndefined();
  });

  it('trims a long title rather than naming a folder after a paragraph', () => {
    const title = starterTitle({ brief: { text: 'x'.repeat(200) } });
    expect(title).toHaveLength(58);
    expect(title?.endsWith('…')).toBe(true);
  });

  it('knows when the answers are worth storing on the session', () => {
    expect(isEmptyStarterAnswers({})).toBe(true);
    expect(isEmptyStarterAnswers({ goal: { ids: [] }, brief: { text: '  ' } })).toBe(true);
    expect(isEmptyStarterAnswers({ goal: { ids: ['tip'] } })).toBe(false);
    expect(isEmptyStarterAnswers({ brief: { text: 'A launch' } })).toBe(false);
  });
});
