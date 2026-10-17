// What the run form's viewer shows while a checkpoint waits (P3 part 7
// follow-up 3(a)): the piece under review, unless the user picked a step.

import { describe, it, expect } from 'vitest';
import type { AgentArtifact, InteractionPayload } from '@shared/types/agents';
import { pendingArtifactId, reviewItems, viewerArtifactId } from './pending-artifact';

const artifact = (id: string, kind: AgentArtifact['kind'] = 'composition'): AgentArtifact =>
  ({ id, kind, title: id, createdAt: '2026-10-17T00:00:00Z', producer: { tool: 't', callId: 'c' }, payload: {} }) as AgentArtifact;

const approve = (artifactId?: string): InteractionPayload => ({
  kind: 'approve',
  title: 'Review: Explainer',
  items: [{ id: 'i1', label: 'Explainer', ...(artifactId ? { artifactId } : {}) }],
});

const pick = (...ids: string[]): InteractionPayload => ({
  kind: 'pick',
  title: 'Review: Images',
  select: 'one',
  candidates: ids.map((id, i) => ({ id, label: `Option ${i + 1}`, artifactId: id })),
});

const form: InteractionPayload = { kind: 'form', title: 'Review: Script', fields: [{ id: 'text', label: 'Text', kind: 'multiline', required: true }] };

describe('reviewItems', () => {
  it('a pick reviews its candidates, an approve its items, a form nothing', () => {
    expect(reviewItems(pick('a', 'b')).map((c) => c.id)).toEqual(['a', 'b']);
    expect(reviewItems(approve('comp-1')).map((c) => c.id)).toEqual(['i1']);
    expect(reviewItems(form)).toEqual([]);
  });
});

describe('pendingArtifactId', () => {
  it('an approve card on a composition names that composition', () => {
    expect(pendingArtifactId(approve('comp-1'), [artifact('script-1', 'document'), artifact('comp-1')])).toBe('comp-1');
  });

  it('a pick names its first candidate the run knows', () => {
    expect(pendingArtifactId(pick('opt-1', 'opt-2'), [artifact('opt-2', 'image-set'), artifact('opt-1', 'image-set')])).toBe('opt-1');
    expect(pendingArtifactId(pick('gone', 'opt-2'), [artifact('opt-2', 'image-set')])).toBe('opt-2');
  });

  it('nothing to show: no card, a form card, an item without an artifact, or one the run has not fetched yet', () => {
    expect(pendingArtifactId(null, [artifact('comp-1')])).toBeNull();
    expect(pendingArtifactId(undefined, [artifact('comp-1')])).toBeNull();
    expect(pendingArtifactId(form, [artifact('comp-1')])).toBeNull();
    expect(pendingArtifactId(approve(), [artifact('comp-1')])).toBeNull();
    expect(pendingArtifactId(approve('comp-1'), [])).toBeNull();
  });
});

describe('viewerArtifactId', () => {
  it('the user’s own pick wins over the piece under review', () => {
    expect(viewerArtifactId({ selectedId: 'mine', pendingId: 'comp-1', firstOutputId: 'video-1' })).toBe('mine');
  });

  it('with no pick, the piece under review wins over the first declared output', () => {
    expect(viewerArtifactId({ selectedId: null, pendingId: 'comp-1', firstOutputId: 'video-1' })).toBe('comp-1');
  });

  it('with no card (or a form card), the first declared output as before', () => {
    expect(viewerArtifactId({ selectedId: null, pendingId: null, firstOutputId: 'video-1' })).toBe('video-1');
    expect(viewerArtifactId({ selectedId: null, pendingId: null, firstOutputId: null })).toBeNull();
  });
});
