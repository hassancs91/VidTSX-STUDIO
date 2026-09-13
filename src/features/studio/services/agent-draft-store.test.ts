import { describe, expect, it } from 'vitest';
import { agentDraftKey, readAgentDraft, writeAgentDraft, type DraftStorage } from './agent-draft-store';

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('agent-draft-store', () => {
  it('round-trips a draft per project', () => {
    const s = memoryStorage();
    writeAgentDraft('p1', 'cut the retakes', s);
    writeAgentDraft('p2', 'add a title', s);
    expect(readAgentDraft('p1', s)).toBe('cut the retakes');
    expect(readAgentDraft('p2', s)).toBe('add a title');
    expect(readAgentDraft('p3', s)).toBe('');
  });

  it('removes the entry when the draft is cleared', () => {
    const s = memoryStorage();
    writeAgentDraft('p1', 'hello', s);
    writeAgentDraft('p1', '', s);
    expect(s.map.has(agentDraftKey('p1'))).toBe(false);
    expect(readAgentDraft('p1', s)).toBe('');
  });

  it('tolerates a throwing or missing storage', () => {
    const broken: DraftStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => writeAgentDraft('p1', 'x', broken)).not.toThrow();
    expect(readAgentDraft('p1', broken)).toBe('');
    expect(readAgentDraft('p1', null)).toBe('');
    expect(() => writeAgentDraft('p1', 'x', null)).not.toThrow();
  });
});
