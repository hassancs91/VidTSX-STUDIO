import type { ThinkingLevel } from '@shared/tsx-engine';

export const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'X-Hi' },
  { value: 'max', label: 'Max' },
];

export const AGENT_TOOLS: { id: string; label: string; title: string }[] = [
  { id: 'WebFetch', label: 'Fetch', title: 'Fetch URL content' },
  { id: 'WebSearch', label: 'Search', title: 'Web search' },
  { id: 'Edit', label: 'Edit', title: 'Edit files' },
  { id: 'Agent', label: 'Agent', title: 'Spawn sub-agents' },
];
