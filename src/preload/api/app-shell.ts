import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  AppGetInfoResponse,
  AppGetIsDevResponse,
  AppOpenExternalRequest,
  AppOpenExternalResponse,
  ClipboardReadTextResponse,
  ContextMenuShowRequest,
  ContextMenuShowResponse,
  DialogOpenRequest,
  DialogOpenResponse,
  DialogSaveRequest,
  DialogSaveResponse,
  ScreenshotCopyRequest,
  ScreenshotCopyResponse,
  ScreenshotSaveRequest,
  ScreenshotSaveResponse,
  ScreenshotSaveToPathRequest,
  ScreenshotSaveToPathResponse,
} from '../../shared/ipc/types';

export const appShellApi = {
  // ─── App operations ───
  // App operations
  appGetInfo: (): Promise<AppGetInfoResponse> =>
    ipcRenderer.invoke(IPC.APP_GET_INFO),
  appOpenExternal: (data: AppOpenExternalRequest): Promise<AppOpenExternalResponse> =>
    ipcRenderer.invoke(IPC.APP_OPEN_EXTERNAL, data),
  appGetIsDev: (): Promise<AppGetIsDevResponse> =>
    ipcRenderer.invoke(IPC.APP_GET_IS_DEV),

  // ─── Dialog operations ───
  // Dialog operations
  dialogOpen: (data?: DialogOpenRequest): Promise<DialogOpenResponse> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN, data),
  dialogSave: (data: DialogSaveRequest): Promise<DialogSaveResponse> =>
    ipcRenderer.invoke(IPC.DIALOG_SAVE, data),

  // ─── Context menu operations ───
  // Context menu operations
  contextMenuShow: (data: ContextMenuShowRequest): Promise<ContextMenuShowResponse> =>
    ipcRenderer.invoke(IPC.CONTEXT_MENU_SHOW, data),

  // ─── Clipboard operations ───
  // Clipboard operations
  clipboardReadText: (): Promise<ClipboardReadTextResponse> =>
    ipcRenderer.invoke(IPC.CLIPBOARD_READ_TEXT),

  // ─── Screenshot operations ───
  // Screenshot operations
  screenshotCopy: (data: ScreenshotCopyRequest): Promise<ScreenshotCopyResponse> =>
    ipcRenderer.invoke(IPC.SCREENSHOT_COPY, data),
  screenshotSave: (data: ScreenshotSaveRequest): Promise<ScreenshotSaveResponse> =>
    ipcRenderer.invoke(IPC.SCREENSHOT_SAVE, data),
  screenshotSaveToPath: (data: ScreenshotSaveToPathRequest): Promise<ScreenshotSaveToPathResponse> =>
    ipcRenderer.invoke(IPC.SCREENSHOT_SAVE_TO_PATH, data),
};
