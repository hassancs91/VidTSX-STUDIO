import { describe, it, expect } from 'vitest';
import type { AgentManifest, AgentSignatureStatus, InstalledAgent } from '@shared/types/agents';
import { capabilitiesFor, trustTagFor } from './manifest-summary';

function manifest(overrides: Partial<AgentManifest> = {}): AgentManifest {
  return {
    formatVersion: 1,
    id: 'vidtsx/motion-post',
    name: 'Motion Post',
    version: '1.0.0',
    description: 'Brief → animated social post.',
    author: { name: 'VidTSX' },
    minAppVersion: '1.1.0',
    prompt: 'AGENT.md',
    tools: [],
    files: [],
    ...overrides,
  };
}

function installed(
  origin: InstalledAgent['origin'],
  signature: AgentSignatureStatus,
): InstalledAgent {
  return { manifest: manifest(), origin, dir: 'C:/x', signature };
}

describe('trustTagFor', () => {
  it('lets a built-in outrank its signature status', () => {
    // Built-ins ship inside the signed installer and carry no signature.json,
    // so they read as `unsigned` on disk (Stage 2 outcome). Labelling a shipped
    // agent "Unverified. Use at your own risk" would be alarming and wrong.
    const tag = trustTagFor(installed('builtin', 'unsigned'));
    expect(tag.label).toBe('Built-in');
    expect(tag.tone).toBe('accent');
    expect(tag.notice).toBeUndefined();
  });

  it('names a known publisher', () => {
    expect(trustTagFor(installed('user', 'verified')).label).toBe('Verified by VidTSX');
  });

  it('warns, but installs, for a valid signature from an unknown key', () => {
    // publishers.ts ships EMPTY until a VidTSX key exists, so this is what
    // every signed package reads as today.
    const tag = trustTagFor(installed('user', 'signed-unknown'));
    expect(tag.label).toBe('Signed, unverified publisher');
    expect(tag.tone).toBe('warning');
    expect(tag.notice).toContain('has not reviewed');
  });

  it('warns for an unsigned user package', () => {
    const tag = trustTagFor(installed('user', 'unsigned'));
    expect(tag.label).toBe('Unverified. Use at your own risk');
    expect(tag.notice).toContain('your providers and credits');
  });
});

describe('capabilitiesFor', () => {
  it('says so in plain words, one line per capability', () => {
    const capabilities = capabilitiesFor(
      manifest({
        tools: ['write_document', 'generate_composition', 'render_composition', 'ask_user'],
        sdkTools: ['WebSearch'],
        workspace: { sdkFileTools: true },
      }),
    );
    expect(capabilities.map((c) => c.id)).toEqual([
      'web',
      'documents',
      'compositions',
      'render',
      'ask',
      'files',
    ]);
    expect(capabilities[0].label).toBe('Browses the web');
  });

  it('names the provider a tool needs', () => {
    const labels = capabilitiesFor(manifest({ tools: ['generate_image', 'generate_video'] })).map(
      (c) => c.label,
    );
    expect(labels).toEqual([
      'Generates images with your image provider',
      'Generates video with your video provider',
    ]);
  });

  it('is empty for a chat-only agent', () => {
    expect(capabilitiesFor(manifest())).toEqual([]);
  });
});
