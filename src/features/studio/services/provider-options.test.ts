import { describe, expect, it } from 'vitest';
import type { LlmProviderConfig } from '@shared/ipc/types';
import { buildAgentProviderOptions } from './provider-options';

const provider = (id: string, name = id): LlmProviderConfig =>
  ({ id, name, type: 'agent-sdk', authMode: 'api-key', defaultModel: 'm', enabled: true }) as LlmProviderConfig;

describe('buildAgentProviderOptions (H2 stranding rule)', () => {
  const providers = [provider('claude-subscription', 'Claude'), provider('zai', 'Z.AI')];

  it('starts with the app-default option, then one option per provider', () => {
    const options = buildAgentProviderOptions(providers, undefined);
    expect(options.map((o) => o.value)).toEqual(['', 'claude-subscription', 'zai']);
  });

  it('a known selected id adds nothing extra', () => {
    const options = buildAgentProviderOptions(providers, 'zai');
    expect(options).toHaveLength(3);
  });

  it('an unknown persisted id renders as an explicit unavailable option, never a blank select', () => {
    const options = buildAgentProviderOptions(providers, 'openai');
    const extra = options.find((o) => o.value === 'openai');
    expect(extra).toBeDefined();
    expect(extra!.label).toContain('unavailable');
    expect(extra!.label).toContain('app default');
  });

  it('does not flag the id as unavailable before the provider list has loaded', () => {
    const options = buildAgentProviderOptions([], 'openai');
    expect(options).toHaveLength(1); // just App default — list not loaded yet
  });
});
