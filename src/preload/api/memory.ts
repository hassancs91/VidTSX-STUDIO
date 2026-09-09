import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  MemoryDeleteRequest,
  MemoryDeleteResponse,
  MemoryListResponse,
  MemoryPromotionResolveRequest,
  MemoryPromotionResolveResponse,
  MemoryPromotionsGetRequest,
  MemoryPromotionsGetResponse,
  MemoryProposalResolveRequest,
  MemoryProposalResolveResponse,
  MemoryProposalsGetRequest,
  MemoryProposalsGetResponse,
  MemorySaveRequest,
  MemorySaveResponse,
  MemorySetActiveRequest,
  MemorySetActiveResponse,
  MemoryVocabularyProposalResolveRequest,
  MemoryVocabularyProposalResolveResponse,
  MemoryVocabularyProposalsGetRequest,
  MemoryVocabularyProposalsGetResponse,
} from '../../shared/ipc/types';

export const memoryApi = {
  // ─── Studio — agent memory (G5) ───
  memoryList: (): Promise<MemoryListResponse> => ipcRenderer.invoke(IPC.MEMORY_LIST),
  memorySave: (data: MemorySaveRequest): Promise<MemorySaveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_SAVE, data),
  memorySetActive: (data: MemorySetActiveRequest): Promise<MemorySetActiveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_SET_ACTIVE, data),
  memoryDelete: (data: MemoryDeleteRequest): Promise<MemoryDeleteResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_DELETE, data),
  memoryProposalsGet: (data: MemoryProposalsGetRequest): Promise<MemoryProposalsGetResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_PROPOSALS_GET, data),
  memoryProposalResolve: (
    data: MemoryProposalResolveRequest
  ): Promise<MemoryProposalResolveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_PROPOSAL_RESOLVE, data),
  memoryPromotionsGet: (data: MemoryPromotionsGetRequest): Promise<MemoryPromotionsGetResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_PROMOTIONS_GET, data),
  memoryPromotionResolve: (
    data: MemoryPromotionResolveRequest
  ): Promise<MemoryPromotionResolveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_PROMOTION_RESOLVE, data),
  // W4: vocabulary cards.
  memoryVocabularyProposalsGet: (
    data: MemoryVocabularyProposalsGetRequest
  ): Promise<MemoryVocabularyProposalsGetResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_VOCABULARY_PROPOSALS_GET, data),
  memoryVocabularyProposalResolve: (
    data: MemoryVocabularyProposalResolveRequest
  ): Promise<MemoryVocabularyProposalResolveResponse> =>
    ipcRenderer.invoke(IPC.MEMORY_VOCABULARY_PROPOSAL_RESOLVE, data),
};
