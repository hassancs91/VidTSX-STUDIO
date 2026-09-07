import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  AGENT_FORMAT_VERSION,
  AgentManifestError,
  compareAgentVersions,
  parseAgentManifest,
} from './manifest';
import { agentDirName, agentDirSegments, parseAgentId } from './ids';

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: AGENT_FORMAT_VERSION,
    id: 'vidtsx/motion-post',
    name: 'Motion Post',
    version: '1.0.0',
    description: 'Brief to animated social post.',
    author: { name: 'VidTSX' },
    minAppVersion: '1.1.0',
    prompt: 'AGENT.md',
    tools: ['write_document', 'ask_user'],
    files: [{ path: 'AGENT.md', size: 12, sha256: sha('AGENT.md') }],
    ...overrides,
  };
}

function problems(raw: Record<string, unknown>, ctx = {}): string[] {
  try {
    parseAgentManifest(raw, ctx);
    return [];
  } catch (err) {
    if (err instanceof AgentManifestError) return err.problems;
    throw err;
  }
}

describe('parseAgentManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const parsed = parseAgentManifest(manifest(), { appVersion: '1.1.0' });
    expect(parsed.id).toBe('vidtsx/motion-post');
    expect(parsed.tools).toEqual(['write_document', 'ask_user']);
  });

  it('rejects an id that is not <namespace>/<name> in the segment grammar', () => {
    for (const id of ['motionpost', 'VidTSX/motion-post', 'vidtsx/motion post', 'a/b/c', 'vidtsx/']) {
      expect(problems(manifest({ id })).join(' ')).toContain('must be');
    }
  });

  it('rejects a non-semver version and minAppVersion', () => {
    expect(problems(manifest({ version: '1.0' })).join(' ')).toContain('semver');
    expect(problems(manifest({ minAppVersion: 'next' })).join(' ')).toContain('semver');
  });

  it('refuses a package that needs a newer app', () => {
    expect(problems(manifest({ minAppVersion: '2.0.0' }), { appVersion: '1.1.0' })).toEqual([
      'needs VidTSX 2.0.0 (this app is 1.1.0)',
    ]);
    expect(problems(manifest({ minAppVersion: '1.0.0' }), { appVersion: '1.1.0' })).toEqual([]);
  });

  it('rejects tool ids the registry does not know', () => {
    const found = problems(manifest({ tools: ['write_document', 'launch_missiles'] }), {
      toolIds: ['write_document', 'ask_user'],
    });
    expect(found).toEqual(['tools "launch_missiles" is not a registered tool']);
  });

  it('never allows Bash, and allows file tools only when the manifest asks', () => {
    expect(problems(manifest({ sdkTools: ['Bash'] })).join(' ')).toContain('never include "Bash"');
    expect(problems(manifest({ sdkTools: ['Read'] })).join(' ')).toContain('not allowed');
    expect(
      problems(manifest({ sdkTools: ['Read', 'WebSearch'], workspace: { sdkFileTools: true } })),
    ).toEqual([]);
  });

  it('requires the prompt (and icon) to be listed in files[]', () => {
    expect(problems(manifest({ prompt: 'PROMPT.md' }))).toEqual([
      'prompt "PROMPT.md" is not listed in files[]',
    ]);
    expect(problems(manifest({ icon: 'icon.png' }))).toEqual([
      'icon "icon.png" is not listed in files[]',
    ]);
  });

  it('requires an https updateUrl', () => {
    expect(problems(manifest({ updateUrl: 'http://vidtsx.com/a.json' }))).toEqual([
      'updateUrl must be an https URL',
    ]);
  });

  it('reports every problem at once', () => {
    const found = problems(manifest({ id: 'BAD', prompt: 'nope.md', updateUrl: 'ftp://x' }));
    expect(found).toHaveLength(3);
  });

  it('validates an embedded starter tree', () => {
    const starter = {
      entry: 'goal',
      nodes: {
        goal: {
          question: 'What kind of post?',
          select: 'one',
          options: [{ id: 'promo', label: 'Promo', next: 'brief' }],
        },
        brief: { question: 'About what?', text: true, next: '$end' },
      },
      opening: 'Make a {{goal}} post about {{brief}}',
    };
    expect(problems(manifest({ starter }))).toEqual([]);
    const broken = { ...starter, opening: 'Make a {{platform}} post' };
    expect(problems(manifest({ starter: broken })).join(' ')).toContain('{{platform}}');
  });

  it('rejects an unsupported formatVersion', () => {
    expect(problems(manifest({ formatVersion: 99 })).join(' ')).toContain('not supported');
  });
});

describe('compareAgentVersions', () => {
  it('orders by numeric triple, ignoring a prerelease suffix', () => {
    expect(compareAgentVersions('1.2.0', '1.10.0')).toBe(-1);
    expect(compareAgentVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareAgentVersions('1.0.0', '1.0.0-beta.1')).toBe(0);
  });
});

describe('agent ids', () => {
  it('parses and rejects', () => {
    expect(parseAgentId('vidtsx/motion-post')).toEqual({
      namespace: 'vidtsx',
      name: 'motion-post',
    });
    expect(parseAgentId('vidtsx/-lead')).toBeNull();
    expect(parseAgentId('../etc/passwd')).toBeNull();
    expect(parseAgentId(42)).toBeNull();
  });

  it('builds folder names only from parsed segments', () => {
    expect(agentDirSegments('vidtsx/motion-post')).toEqual(['vidtsx', 'motion-post']);
    expect(agentDirName('vidtsx/motion-post')).toBe('vidtsx.motion-post');
    expect(() => agentDirName('../x')).toThrow(/Invalid agent id/);
  });
});
