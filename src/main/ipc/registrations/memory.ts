import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleMemoryDelete,
  handleMemoryList,
  handleMemoryPromotionResolve,
  handleMemoryPromotionsGet,
  handleMemoryProposalResolve,
  handleMemoryProposalsGet,
  handleMemorySave,
  handleMemorySetActive,
} from '../memory-handlers';
import {
  handleMemoryVocabularyProposalResolve,
  handleMemoryVocabularyProposalsGet,
} from '../vocabulary-handlers';

export function registerMemoryIpc(): void {
  ipcMain.handle(IPC.MEMORY_LIST, handleMemoryList);
  ipcMain.handle(IPC.MEMORY_SAVE, handleMemorySave);
  ipcMain.handle(IPC.MEMORY_SET_ACTIVE, handleMemorySetActive);
  ipcMain.handle(IPC.MEMORY_DELETE, handleMemoryDelete);
  ipcMain.handle(IPC.MEMORY_PROPOSALS_GET, handleMemoryProposalsGet);
  ipcMain.handle(IPC.MEMORY_PROPOSAL_RESOLVE, handleMemoryProposalResolve);
  ipcMain.handle(IPC.MEMORY_PROMOTIONS_GET, handleMemoryPromotionsGet);
  ipcMain.handle(IPC.MEMORY_PROMOTION_RESOLVE, handleMemoryPromotionResolve);
  ipcMain.handle(IPC.MEMORY_VOCABULARY_PROPOSALS_GET, handleMemoryVocabularyProposalsGet);
  ipcMain.handle(IPC.MEMORY_VOCABULARY_PROPOSAL_RESOLVE, handleMemoryVocabularyProposalResolve);
}
