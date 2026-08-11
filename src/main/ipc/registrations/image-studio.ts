import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc/channels';
import {
  handleImageProvidersGet,
  handleImageProvidersSave,
  handleImageProviderTest,
  handleImageModelsGet,
  handleImageGenerate,
  handleImageGenerateCancel,
  handleImageProviderSwitch,
} from '../image-handlers';
import {
  handleImageStudioSave,
  handleImageStudioList,
  handleImageStudioDelete,
  handleImageStudioSaveAs,
  handleImageStudioCopy,
  handleImageStudioRead,
} from '../image-studio-handlers';
import {
  handleImageStudioFolderCreate,
  handleImageStudioFolderRename,
  handleImageStudioFolderDelete,
  handleImageStudioMoveToFolder,
} from '../image-studio-folder-handlers';
import {
  handleRefImageSave,
  handleRefImageList,
  handleRefImageDelete,
  handleRefImageToggle,
  handleRefImageRead,
} from '../ref-image-handlers';
import { ensureSdImageEngine } from '../../services/sdimage-init';
import { lazily } from './lazy';

export function registerImageStudioIpc(): void {
  ipcMain.handle(IPC.IMAGE_PROVIDERS_GET, handleImageProvidersGet);
  ipcMain.handle(IPC.IMAGE_PROVIDERS_SAVE, handleImageProvidersSave);
  ipcMain.handle(IPC.IMAGE_PROVIDER_TEST, handleImageProviderTest);
  // The cloud image engine's "local" provider bridges to the sd-cli engine —
  // listing models / generating must lazily init it (scan + resolver) so
  // local models work in Image Studio without visiting the AI page first.
  ipcMain.handle(IPC.IMAGE_MODELS_GET, lazily(ensureSdImageEngine, handleImageModelsGet));
  ipcMain.handle(IPC.IMAGE_GENERATE, lazily(ensureSdImageEngine, handleImageGenerate));
  ipcMain.handle(IPC.IMAGE_GENERATE_CANCEL, handleImageGenerateCancel);
  ipcMain.handle(IPC.IMAGE_PROVIDER_SWITCH, handleImageProviderSwitch);
  ipcMain.handle(IPC.IMAGE_STUDIO_SAVE, handleImageStudioSave);
  ipcMain.handle(IPC.IMAGE_STUDIO_LIST, handleImageStudioList);
  ipcMain.handle(IPC.IMAGE_STUDIO_DELETE, handleImageStudioDelete);
  ipcMain.handle(IPC.IMAGE_STUDIO_SAVE_AS, handleImageStudioSaveAs);
  ipcMain.handle(IPC.IMAGE_STUDIO_COPY, handleImageStudioCopy);
  ipcMain.handle(IPC.IMAGE_STUDIO_READ, handleImageStudioRead);
  ipcMain.handle(IPC.IMAGE_STUDIO_FOLDER_CREATE, handleImageStudioFolderCreate);
  ipcMain.handle(IPC.IMAGE_STUDIO_FOLDER_RENAME, handleImageStudioFolderRename);
  ipcMain.handle(IPC.IMAGE_STUDIO_FOLDER_DELETE, handleImageStudioFolderDelete);
  ipcMain.handle(IPC.IMAGE_STUDIO_MOVE_TO_FOLDER, handleImageStudioMoveToFolder);
  ipcMain.handle(IPC.REF_IMAGE_SAVE, handleRefImageSave);
  ipcMain.handle(IPC.REF_IMAGE_LIST, handleRefImageList);
  ipcMain.handle(IPC.REF_IMAGE_DELETE, handleRefImageDelete);
  ipcMain.handle(IPC.REF_IMAGE_TOGGLE, handleRefImageToggle);
  ipcMain.handle(IPC.REF_IMAGE_READ, handleRefImageRead);
}
