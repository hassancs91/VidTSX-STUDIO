import { describe, it, expect } from 'vitest';
import type { AgentArtifact } from '@shared/types/agents';
import { matchRenderJob, matchRenderRow, pendingRenderJobs } from './render-job-match';

function jobArtifact(
  id: string,
  jobId: string,
  extra: Partial<Extract<AgentArtifact, { kind: 'job' }>['payload']> = {},
): AgentArtifact {
  return {
    id,
    kind: 'job',
    title: `Render — ${id}`,
    createdAt: '2026-09-08T00:00:00.000Z',
    producer: { tool: 'render_composition', callId: 'c1' },
    payload: { jobId, job: 'render', status: 'running', ...extra },
  };
}

const composition: AgentArtifact = {
  id: 'composition-1',
  kind: 'composition',
  title: 'A card',
  createdAt: '2026-09-08T00:00:00.000Z',
  producer: { tool: 'generate_composition', callId: 'c0' },
  payload: {
    relPath: 'compositions/a-card.tsx',
    moduleUrl: 'http://127.0.0.1:3200/modules/abc.js',
    config: { id: 'ACard', width: 1080, height: 1920, fps: 30, durationInFrames: 180 },
  },
};

describe('matchRenderJob', () => {
  it('matches on the job id while the row still wears it', () => {
    const artifacts = [composition, jobArtifact('job-2', 'uuid-a')];
    expect(matchRenderJob(artifacts, { id: 'uuid-a' })?.id).toBe('job-2');
  });

  it('matches on the output path after the queue rewrites the row id', () => {
    // `startNextJob` replaces the row's id with the one main mints for the
    // render. Without this fallback the finished render is never filed.
    const artifacts = [
      composition,
      jobArtifact('job-2', 'uuid-a', { outputRelPath: 'agents/motion-post/a-post/card.mp4' }),
    ];
    expect(
      matchRenderJob(artifacts, {
        id: 'a-completely-different-id',
        outputPath: 'C:\\Users\\h\\AppData\\assets\\agents\\motion-post\\a-post\\card.mp4',
      })?.id,
    ).toBe('job-2');
  });

  it('is case- and separator-insensitive, because Windows is', () => {
    const artifacts = [jobArtifact('job-2', 'uuid-a', { outputRelPath: 'agents/A/B/Card.mp4' })];
    expect(
      matchRenderJob(artifacts, { id: 'other', outputPath: 'D:/lib/agents/a/b/card.mp4' })?.id,
    ).toBe('job-2');
  });

  it('never matches a job that has already been filed', () => {
    const artifacts = [
      jobArtifact('job-2', 'uuid-a', {
        outputRelPath: 'agents/x/card.mp4',
        resultArtifactId: 'video-3',
      }),
    ];
    expect(matchRenderJob(artifacts, { id: 'uuid-a' })).toBeUndefined();
    expect(matchRenderJob(artifacts, { id: 'other', outputPath: '/lib/agents/x/card.mp4' })).toBeUndefined();
  });

  it('never matches a video job — those are the engine\'s, not the queue\'s', () => {
    const artifacts: AgentArtifact[] = [
      {
        ...(jobArtifact('job-2', 'uuid-a') as Extract<AgentArtifact, { kind: 'job' }>),
        payload: { jobId: 'uuid-a', job: 'video', status: 'running' },
      },
    ];
    expect(matchRenderJob(artifacts, { id: 'uuid-a' })).toBeUndefined();
  });

  it('prefers the id over the path when both could match different jobs', () => {
    const artifacts = [
      jobArtifact('job-2', 'uuid-a', { outputRelPath: 'agents/x/card.mp4' }),
      jobArtifact('job-4', 'uuid-b', { outputRelPath: 'agents/x/card.mp4' }),
    ];
    expect(matchRenderJob(artifacts, { id: 'uuid-b', outputPath: '/lib/agents/x/card.mp4' })?.id).toBe(
      'job-4',
    );
  });

  it('matches nothing when the row is neither known nor named', () => {
    expect(matchRenderJob([composition], { id: 'uuid-a' })).toBeUndefined();
    expect(matchRenderJob([jobArtifact('job-2', 'uuid-a')], { id: 'other' })).toBeUndefined();
  });

  it('lists only the render jobs still waiting to be filed', () => {
    const artifacts = [
      composition,
      jobArtifact('job-2', 'uuid-a'),
      jobArtifact('job-4', 'uuid-b', { resultArtifactId: 'video-5' }),
    ];
    expect(pendingRenderJobs(artifacts).map((a) => a.id)).toEqual(['job-2']);
  });
});

describe('matchRenderRow', () => {
  // The inverted direction: the stage holds ONE artifact and needs the row that
  // is showing its progress. Without this the Cancel button vanished the moment
  // the render started, which is when it matters.
  const done = { id: 'main-1', outputPath: 'D:/lib/agents/x/card.mp4', status: 'done' };
  const rendering = { id: 'main-2', outputPath: 'D:/lib/agents/x/card.mp4', status: 'rendering' };

  it('matches on the job id while the row still wears it', () => {
    const rows = [{ id: 'uuid-a', status: 'queued' }, done];
    expect(matchRenderRow(jobArtifact('job-2', 'uuid-a'), rows)?.id).toBe('uuid-a');
  });

  it('matches on the output path after the queue rewrites the row id', () => {
    const artifact = jobArtifact('job-2', 'uuid-a', { outputRelPath: 'agents/x/card.mp4' });
    expect(matchRenderRow(artifact, [rendering])?.id).toBe('main-2');
  });

  it('prefers a live row over a settled one sharing the same output path', () => {
    // An agent that renders twice to the same output name leaves two rows on
    // one path; only one of them is the render this artifact is waiting on.
    const artifact = jobArtifact('job-6', 'uuid-b', { outputRelPath: 'agents/x/card.mp4' });
    expect(matchRenderRow(artifact, [done, rendering])?.id).toBe('main-2');
  });

  it('falls back to a settled row when no live one shares the path', () => {
    const artifact = jobArtifact('job-2', 'uuid-a', { outputRelPath: 'agents/x/card.mp4' });
    expect(matchRenderRow(artifact, [done])?.id).toBe('main-1');
  });

  it('matches nothing for a video job, a non-job artifact, or an unnamed one', () => {
    expect(matchRenderRow(composition, [rendering])).toBeUndefined();
    const video = jobArtifact('job-2', 'uuid-a') as Extract<AgentArtifact, { kind: 'job' }>;
    expect(
      matchRenderRow({ ...video, payload: { jobId: 'uuid-a', job: 'video', status: 'running' } }, [
        { id: 'uuid-a', status: 'rendering' },
      ]),
    ).toBeUndefined();
    expect(matchRenderRow(jobArtifact('job-2', 'uuid-a'), [rendering])).toBeUndefined();
  });
});
