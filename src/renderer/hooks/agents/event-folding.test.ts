import { describe, it, expect } from 'vitest';
import type { AgentArtifact } from '@shared/types/agents';
import type { AgentChatRow } from './event-folding';
import {
  appendDelta,
  appendToolCall,
  finishTurn,
  mergeArtifact,
  noteOnPending,
  preferredArtifactId,
  startTurn,
} from './event-folding';

function artifact(id: string, kind: AgentArtifact['kind'], extra = {}): AgentArtifact {
  return {
    id,
    kind,
    title: id,
    createdAt: '2026-09-08T00:00:00.000Z',
    producer: { tool: 't', callId: 'c' },
    payload: { ...extra },
  } as AgentArtifact;
}

describe('turn folding', () => {
  it('opens a user row and a pending assistant row', () => {
    const rows = startTurn([], 'make a teaser');
    expect(rows.map((r) => r.role)).toEqual(['user', 'assistant']);
    expect(rows[1].pending).toBe(true);
  });

  it('appends deltas to the pending row only', () => {
    const rows = appendDelta(appendDelta(startTurn([], 'go'), 'Hel'), 'lo');
    expect(rows[1].text).toBe('Hello');
  });

  it('leaves a settled list alone when no row is pending', () => {
    const settled: AgentChatRow[] = [{ id: 'a', role: 'assistant', text: 'done' }];
    expect(appendDelta(settled, 'more')).toBe(settled);
  });

  it('restarts the streamed text on a tool call', () => {
    // The model's next turn follows the tool result, so deltas after a tool
    // must not append to the sentence the tool interrupted.
    let rows = appendDelta(startTurn([], 'go'), 'Let me check');
    rows = appendToolCall(rows, 'write_document', 'Hook variants');
    expect(rows[1].text).toBe('');
    expect(rows[1].toolCalls).toEqual([{ tool: 'write_document', detail: 'Hook variants' }]);

    rows = appendDelta(rows, 'Here it is');
    expect(rows[1].text).toBe('Here it is');
  });

  it('carries an error onto the pending row and closes it', () => {
    const rows = finishTurn(startTurn([], 'go'), { error: 'no provider' });
    expect(rows[1]).toMatchObject({ pending: false, error: true, text: 'no provider' });
  });

  it('keeps the streamed text when the turn ends with no final text', () => {
    const rows = finishTurn(appendDelta(startTurn([], 'go'), 'streamed'), {});
    expect(rows[1]).toMatchObject({ pending: false, text: 'streamed' });
  });

  it('attaches a note to the pending row', () => {
    const rows = noteOnPending(startTurn([], 'go'), 'Queued for rendering.');
    expect(rows[1].note).toBe('Queued for rendering.');
  });
});

describe('mergeArtifact', () => {
  it('appends a new artifact and replaces one it already has', () => {
    const first = artifact('job-1', 'job', { jobId: 'j', job: 'render', status: 'pending' });
    const list = mergeArtifact([], first);
    expect(list).toHaveLength(1);

    const updated = artifact('job-1', 'job', { jobId: 'j', job: 'render', status: 'running' });
    const merged = mergeArtifact(list, updated);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind === 'job' && merged[0].payload.status).toBe('running');
  });
});

describe('preferredArtifactId', () => {
  it('is the newest artifact', () => {
    const list = [artifact('document-1', 'document', { relPath: 'a.md' }), artifact('video-2', 'video', { relPath: 'b.mp4', durationSeconds: 3 })];
    expect(preferredArtifactId(list)).toBe('video-2');
  });

  it('skips a job that has already produced its result', () => {
    // The result is the more interesting artifact and lands right after it.
    const list = [
      artifact('video-2', 'video', { relPath: 'b.mp4', durationSeconds: 3 }),
      artifact('job-1', 'job', { jobId: 'j', job: 'render', status: 'completed', resultArtifactId: 'video-2' }),
    ];
    expect(preferredArtifactId(list)).toBe('video-2');
  });

  it('shows a job that is still running', () => {
    const list = [artifact('job-1', 'job', { jobId: 'j', job: 'render', status: 'running' })];
    expect(preferredArtifactId(list)).toBe('job-1');
  });

  it('is null for an empty session', () => {
    expect(preferredArtifactId([])).toBeNull();
  });
});
