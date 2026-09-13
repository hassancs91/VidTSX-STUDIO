import { describe, it, expect } from 'vitest';
import type { StudioAgentChatMessage } from '@shared/ipc/types';
import { agentChatExportFileName, formatAgentChatMarkdown } from './agent-chat-export';

const messages: Array<StudioAgentChatMessage & { pending?: boolean }> = [
  { id: 'u1', role: 'user', text: 'cut the retakes', at: '2026-09-12T10:00:00.000Z' },
  {
    id: 'a1',
    role: 'assistant',
    text: 'Proposed 3 cuts.',
    at: '2026-09-12T10:00:20.000Z',
    providerId: 'anthropic',
    model: 'claude-sonnet-5',
    toolCalls: [
      { tool: 'get_transcript', detail: 'DJI_0323', args: '{"assetId":"a1"}', result: 'words: 1200' },
      { tool: 'propose_cuts', detail: '3 cuts', args: '{"cuts":[1,2,3]}', result: 'ok ```inner```' },
    ],
    proposalNote: '3 cuts to review',
  },
  { id: 'u2', role: 'user', text: 'and the fillers' },
  { id: 'a2', role: 'assistant', text: 'Provider timed out', error: true },
  { id: 'a3', role: 'assistant', text: 'half…', pending: true },
];

const meta = { projectName: 'video-10', exportedAt: new Date('2026-09-12T12:00:00Z') };

describe('formatAgentChatMarkdown', () => {
  it('messages only: header, turns in order, tool chips, no arguments or results', () => {
    const md = formatAgentChatMarkdown(messages, meta, { includeToolDetails: false });
    expect(md.startsWith('# Assistant chat — video-10\n')).toBe(true);
    expect(md).toContain('4 messages');
    expect(md).toContain('model anthropic / claude-sonnet-5');
    expect(md.indexOf('### You')).toBeLessThan(md.indexOf('### Assistant'));
    expect(md).toContain('cut the retakes');
    expect(md).toContain('- tool `get_transcript` — DJI_0323');
    expect(md).toContain('- proposal: 3 cuts to review');
    expect(md).toContain('**Error:** Provider timed out');
    expect(md).not.toContain('"assetId"');
    expect(md).not.toContain('words: 1200');
    // The streaming row never lands in the record.
    expect(md).not.toContain('half…');
  });

  it('with tool details: arguments and results in fences, widened around inner backticks', () => {
    const md = formatAgentChatMarkdown(messages, meta, { includeToolDetails: true });
    expect(md).toContain('with tool arguments and results');
    expect(md).toContain('<details><summary>get_transcript</summary>');
    expect(md).toContain('```json\n{"assetId":"a1"}\n```');
    expect(md).toContain('```\nwords: 1200\n```');
    expect(md).toContain('````\nok ```inner```\n````');
  });

  it('falls back to the project setting for the model line', () => {
    const md = formatAgentChatMarkdown(
      [{ id: 'u', role: 'user', text: 'hi' }],
      { ...meta, providerId: 'openai', model: 'gpt-x' },
      { includeToolDetails: false },
    );
    expect(md).toContain('model openai / gpt-x');
  });
});

describe('agentChatExportFileName', () => {
  it('slugs the project name and stamps the date', () => {
    expect(agentChatExportFileName('video-10 · the 7 security blocks', new Date(2026, 8, 12, 9, 5))).toBe(
      'video-10-the-7-security-blocks-assistant-2026-09-12-0905.md',
    );
    expect(agentChatExportFileName('···', new Date(2026, 0, 1, 0, 0))).toBe('project-assistant-2026-01-01-0000.md');
  });
});
