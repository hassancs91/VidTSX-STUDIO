import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleLlmProvidersGet,
  handleLlmProvidersSave,
  handleLlmProviderTest,
  handleLlmGenerate,
  handleLlmChatGenerate,
  handleLlmCancel,
} from '../llm-handlers';
import {
  handleSkillsList,
} from '../skills-handlers';

export function registerLlmIpc(): void {
  ipcMain.handle(IPC.LLM_PROVIDERS_GET, handleLlmProvidersGet);
  ipcMain.handle(IPC.LLM_PROVIDERS_SAVE, handleLlmProvidersSave);
  ipcMain.handle(IPC.LLM_PROVIDER_TEST, handleLlmProviderTest);
  ipcMain.handle(IPC.LLM_GENERATE, handleLlmGenerate);
  ipcMain.handle(IPC.LLM_CHAT_GENERATE, handleLlmChatGenerate);
  ipcMain.handle(IPC.LLM_CANCEL, handleLlmCancel);
  ipcMain.handle(IPC.SKILLS_LIST, handleSkillsList);
}
