import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleCreatorPushTemplate,
  handleCreatorGenerateThumbnail,
  handleCreatorLoadPushDraft,
  handleCreatorSavePushDraft,
  handleCreatorArchiveTsx,
} from '../creator-handlers';

export function registerCreatorIpc(): void {
  ipcMain.handle(IPC.CREATOR_PUSH_TEMPLATE, handleCreatorPushTemplate);
  ipcMain.handle(IPC.CREATOR_GENERATE_THUMBNAIL, handleCreatorGenerateThumbnail);
  ipcMain.handle(IPC.CREATOR_LOAD_PUSH_DRAFT, handleCreatorLoadPushDraft);
  ipcMain.handle(IPC.CREATOR_SAVE_PUSH_DRAFT, handleCreatorSavePushDraft);
  ipcMain.handle(IPC.CREATOR_ARCHIVE_TSX, handleCreatorArchiveTsx);
}
