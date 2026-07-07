import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  BundleCreateRequest,
  BundleCreateResponse,
  BundleInvalidateRequest,
  BundleInvalidateResponse,
  BundleProgressEvent,
  ModuleServerUrlResponse,
  ModuleTranspileRequest,
  ModuleTranspileResponse,
  TsxValidateRequest,
  TsxValidateResponse,
} from '../../shared/ipc/types';

export const bundleApi = {
  // ─── Bundle operations ───
  // Bundle operations
  bundleCreate: (data: BundleCreateRequest): Promise<BundleCreateResponse> =>
    ipcRenderer.invoke(IPC.BUNDLE_CREATE, data),
  bundleInvalidate: (data: BundleInvalidateRequest): Promise<BundleInvalidateResponse> =>
    ipcRenderer.invoke(IPC.BUNDLE_INVALIDATE, data),
  onBundleProgress: (callback: (data: BundleProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: BundleProgressEvent) => callback(data);
    ipcRenderer.on(IPC.BUNDLE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.BUNDLE_PROGRESS, handler);
  },

  // ─── Module operations (native player) ───
  // Module operations (native player)
  moduleTranspile: (data: ModuleTranspileRequest): Promise<ModuleTranspileResponse> =>
    ipcRenderer.invoke(IPC.MODULE_TRANSPILE, data),
  moduleServerUrl: (): Promise<ModuleServerUrlResponse> =>
    ipcRenderer.invoke(IPC.MODULE_SERVER_URL),

  // ─── TSX validation ───
  // TSX validation
  tsxValidate: (data: TsxValidateRequest): Promise<TsxValidateResponse> =>
    ipcRenderer.invoke(IPC.TSX_VALIDATE, data),
};
