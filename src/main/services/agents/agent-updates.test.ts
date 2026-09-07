import { describe, it, expect } from 'vitest';
import type { AgentManifest } from '../../../shared/types/agents';
import { AgentUpdateError, checkAgentUpdate, parseAgentUpdate } from './agent-updates';

const manifest = (overrides: Partial<AgentManifest> = {}): AgentManifest =>
  ({
    formatVersion: 1,
    id: 'vidtsx/motion-post',
    name: 'Motion Post',
    version: '1.0.0',
    description: '',
    author: { name: 'VidTSX' },
    minAppVersion: '1.0.0',
    prompt: 'AGENT.md',
    tools: [],
    files: [],
    updateUrl: 'https://vidtsx.com/agents/vidtsx.motion-post.json',
    ...overrides,
  }) as AgentManifest;

const feed = (latest: Record<string, unknown>): Record<string, unknown> => ({
  id: 'vidtsx/motion-post',
  latest,
});

const respondWith = (body: unknown, init: { ok?: boolean; status?: number } = {}): typeof fetch =>
  (async () =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    }) as Response) as unknown as typeof fetch;

describe('parseAgentUpdate', () => {
  it('reports a newer, compatible version', () => {
    const info = parseAgentUpdate(
      feed({ version: '1.2.0', url: 'https://vidtsx.com/d/x.vidtsxagent', minAppVersion: '1.0.0' }),
      manifest(),
      '1.0.0',
    );
    expect(info).toMatchObject({ version: '1.2.0', compatible: true });
  });

  it('reports a newer version that needs a newer app as incompatible', () => {
    const info = parseAgentUpdate(
      feed({
        version: '2.0.0',
        url: 'https://vidtsx.com/d/x.vidtsxagent',
        minAppVersion: '1.4.0',
        notes: 'Adds video',
      }),
      manifest(),
      '1.0.0',
    );
    expect(info).toEqual({
      version: '2.0.0',
      url: 'https://vidtsx.com/d/x.vidtsxagent',
      minAppVersion: '1.4.0',
      notes: 'Adds video',
      compatible: false,
    });
  });

  it('says nothing for an equal or older version', () => {
    for (const version of ['1.0.0', '0.9.9']) {
      expect(
        parseAgentUpdate(
          feed({ version, url: 'https://vidtsx.com/d/x.vidtsxagent' }),
          manifest(),
          '1.0.0',
        ),
      ).toBeNull();
    }
  });

  it('refuses a feed that describes a different agent', () => {
    expect(() =>
      parseAgentUpdate(
        { id: 'someone/else', latest: { version: '9.0.0', url: 'https://x.test/a' } },
        manifest(),
        '1.0.0',
      ),
    ).toThrow(/different agent/);
  });

  it('refuses a non-https download link', () => {
    expect(() =>
      parseAgentUpdate(
        feed({ version: '2.0.0', url: 'http://vidtsx.com/d/x.vidtsxagent' }),
        manifest(),
        '1.0.0',
      ),
    ).toThrow(/https/);
  });

  it('refuses a feed with no usable version or latest block', () => {
    expect(() => parseAgentUpdate({ id: 'vidtsx/motion-post' }, manifest(), '1.0.0')).toThrow(
      /no "latest" block/,
    );
    expect(() =>
      parseAgentUpdate(feed({ version: 'newest', url: 'https://x.test/a' }), manifest(), '1.0.0'),
    ).toThrow(/no usable version/);
  });

  it('treats a missing minAppVersion as "runs anywhere"', () => {
    const info = parseAgentUpdate(
      feed({ version: '1.1.0', url: 'https://vidtsx.com/d/x.vidtsxagent' }),
      manifest(),
      '1.0.0',
    );
    expect(info).toMatchObject({ minAppVersion: '0.0.0', compatible: true });
  });
});

describe('checkAgentUpdate', () => {
  it('fetches the manifest updateUrl once and evaluates it', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify(feed({ version: '3.0.0', url: 'https://vidtsx.com/d/x.vidtsxagent' })),
      } as Response;
    }) as unknown as typeof fetch;

    const info = await checkAgentUpdate(manifest(), { appVersion: '1.0.0', fetchImpl });
    expect(info?.version).toBe('3.0.0');
    expect(calls).toEqual(['https://vidtsx.com/agents/vidtsx.motion-post.json']);
  });

  it('does nothing for an agent that declares no updateUrl', async () => {
    const info = await checkAgentUpdate(manifest({ updateUrl: undefined }), {
      appVersion: '1.0.0',
      fetchImpl: respondWith(feed({ version: '9.0.0', url: 'https://x.test/a' })),
    });
    expect(info).toBeNull();
  });

  it('refuses a non-https updateUrl without fetching', async () => {
    let fetched = false;
    const fetchImpl = (async () => {
      fetched = true;
      return {} as Response;
    }) as unknown as typeof fetch;
    await expect(
      checkAgentUpdate(manifest({ updateUrl: 'http://vidtsx.com/f.json' }), {
        appVersion: '1.0.0',
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(AgentUpdateError);
    expect(fetched).toBe(false);
  });

  it('turns a server error, a network failure and bad JSON into one sentence each', async () => {
    await expect(
      checkAgentUpdate(manifest(), {
        appVersion: '1.0.0',
        fetchImpl: respondWith('', { ok: false, status: 503 }),
      }),
    ).rejects.toThrow(/answered 503/);

    const boom = (async () => {
      throw new Error('ENOTFOUND');
    }) as unknown as typeof fetch;
    await expect(
      checkAgentUpdate(manifest(), { appVersion: '1.0.0', fetchImpl: boom }),
    ).rejects.toThrow(/Could not reach/);

    await expect(
      checkAgentUpdate(manifest(), { appVersion: '1.0.0', fetchImpl: respondWith('{ not json') }),
    ).rejects.toThrow(/not readable JSON/);
  });

  it('refuses an implausibly large feed', async () => {
    await expect(
      checkAgentUpdate(manifest(), {
        appVersion: '1.0.0',
        fetchImpl: respondWith('x'.repeat(70_000)),
      }),
    ).rejects.toThrow(/implausibly large/);
  });
});
