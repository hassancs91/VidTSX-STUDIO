// W4 vocabulary cards: accept merges the ticked terms into the LIBRARY
// brand against a fresh read and retires the memories the brand now
// carries; the brand store and the memory store are mocked, the pending
// queue is real module state.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioBrand } from '../../shared/types/asset-library';
import type { StudioMemory } from '../../shared/types/studio-memory';

const brandStore = vi.hoisted(() => ({ readBrand: vi.fn(), updateBrand: vi.fn() }));
const memoryStore = vi.hoisted(() => ({ listMemories: vi.fn(), setMemoryActive: vi.fn() }));

vi.mock('../services/library/brand-store', () => brandStore);
vi.mock('../services/library/library-paths', () => ({ getLibraryRoot: () => 'C:/lib' }));
vi.mock('../services/studio/agent-memory', () => memoryStore);

import {
  handleMemoryVocabularyProposalResolve,
  handleMemoryVocabularyProposalsGet,
} from './vocabulary-handlers';
import {
  addVocabularyProposal,
  clearAllVocabularyProposals,
  hasPendingVocabularyProposal,
} from '../services/studio/agent-vocabulary-proposals';

const event = {} as Parameters<typeof handleMemoryVocabularyProposalsGet>[0];

const BRAND: StudioBrand = {
  id: 'acme',
  name: 'Acme',
  palette: { primary: '#fff', secondary: '#fff', background: '#000', text: '#fff', accent: '#f00' },
  fonts: { display: 'Inter' },
  logoRefs: [],
  styleNotes: 'Minimal.',
  vocabulary: [{ term: 'VidTSX', aliases: ['Vid TSX'] }],
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

function memory(overrides: Partial<StudioMemory>): StudioMemory {
  return {
    id: 'm',
    kind: 'vocabulary',
    text: 'LearnWithHasan',
    active: true,
    source: { by: 'user' },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function queue() {
  return addVocabularyProposal({
    projectId: 'p1',
    brandId: 'acme',
    brandName: 'Acme',
    terms: [
      { term: 'VidTSX', aliases: ['vid t s x'], source: 'transcript' },
      { term: 'LearnWithHasan', aliases: ['learn with hassan'], source: 'script' },
      { term: 'Remotion', source: 'script' },
    ],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearAllVocabularyProposals();
  brandStore.readBrand.mockResolvedValue(BRAND);
  brandStore.updateBrand.mockImplementation(async (_root: string, _id: string, input: unknown) => ({ ...BRAND, ...(input as object) }));
  memoryStore.listMemories.mockResolvedValue([
    memory({ id: 'm-app', text: 'learnwithhasan' }),
    memory({ id: 'm-other-brand', text: 'Remotion', brandId: 'other' }),
    memory({ id: 'm-rule', kind: 'rule', text: 'Remotion' }),
    memory({ id: 'm-agent', text: 'Remotion', agentId: 'vidtsx/motion-post' }),
  ]);
  memoryStore.setMemoryActive.mockResolvedValue(undefined);
});

describe('handleMemoryVocabularyProposalsGet', () => {
  it('lists the pending card for the project', async () => {
    const proposal = queue();
    const res = await handleMemoryVocabularyProposalsGet(event, { projectId: 'p1' });
    expect(res).toEqual({ success: true, proposals: [proposal] });
    expect((await handleMemoryVocabularyProposalsGet(event, { projectId: 'p2' })).proposals).toEqual([]);
  });
});

describe('handleMemoryVocabularyProposalResolve', () => {
  it('accept merges the ticked terms into the brand, keeps the rest, retires matching memories', async () => {
    const proposal = queue();
    const res = await handleMemoryVocabularyProposalResolve(event, {
      proposalId: proposal.id,
      projectId: 'p1',
      action: 'accept',
      terms: ['VidTSX', 'LearnWithHasan'],
    });
    expect(res).toEqual({ success: true, added: ['LearnWithHasan'], merged: ['VidTSX'], retiredMemories: 1 });
    const input = brandStore.updateBrand.mock.calls[0][2];
    expect(input.vocabulary).toEqual([
      { term: 'VidTSX', aliases: ['Vid TSX', 'vid t s x'] },
      { term: 'LearnWithHasan', aliases: ['learn with hassan'] },
    ]);
    expect(input.styleNotes).toBe('Minimal.'); // the rest of the brand survives
    expect(memoryStore.setMemoryActive).toHaveBeenCalledTimes(1);
    expect(memoryStore.setMemoryActive).toHaveBeenCalledWith('m-app', false);
    expect(hasPendingVocabularyProposal('p1')).toBe(false);
  });

  it('accept with no terms list takes every term', async () => {
    const proposal = queue();
    const res = await handleMemoryVocabularyProposalResolve(event, {
      proposalId: proposal.id,
      projectId: 'p1',
      action: 'accept',
    });
    expect(res.success).toBe(true);
    expect(res.added).toEqual(['LearnWithHasan', 'Remotion']);
  });

  it('refuses an empty selection and keeps the card', async () => {
    const proposal = queue();
    const res = await handleMemoryVocabularyProposalResolve(event, {
      proposalId: proposal.id,
      projectId: 'p1',
      action: 'accept',
      terms: [],
    });
    expect(res.success).toBe(false);
    expect(hasPendingVocabularyProposal('p1')).toBe(true);
    expect(brandStore.updateBrand).not.toHaveBeenCalled();
  });

  it('reject discards; a vanished brand discards with an error; a full brand keeps the card', async () => {
    const proposal = queue();
    expect(await handleMemoryVocabularyProposalResolve(event, { proposalId: proposal.id, projectId: 'p1', action: 'reject' })).toEqual({ success: true });
    expect(hasPendingVocabularyProposal('p1')).toBe(false);

    const gone = queue();
    brandStore.readBrand.mockResolvedValueOnce(null);
    const res = await handleMemoryVocabularyProposalResolve(event, { proposalId: gone.id, projectId: 'p1', action: 'accept' });
    expect(res.success).toBe(false);
    expect(hasPendingVocabularyProposal('p1')).toBe(false);

    const full = queue();
    brandStore.readBrand.mockResolvedValueOnce({
      ...BRAND,
      vocabulary: Array.from({ length: 200 }, (_, i) => ({ term: `t${i}` })),
    });
    const overflow = await handleMemoryVocabularyProposalResolve(event, { proposalId: full.id, projectId: 'p1', action: 'accept' });
    expect(overflow.success).toBe(false);
    expect(overflow.error).toContain('full');
    expect(hasPendingVocabularyProposal('p1')).toBe(true);
    expect(brandStore.updateBrand).not.toHaveBeenCalled();
  });

  it('answers a stale id without touching anything', async () => {
    const res = await handleMemoryVocabularyProposalResolve(event, { proposalId: 'nope', projectId: 'p1', action: 'accept' });
    expect(res.success).toBe(false);
  });
});
