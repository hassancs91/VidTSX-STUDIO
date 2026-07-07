import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  FileCreateFolderRequest,
  FileCreateFolderResponse,
  FileDeleteRequest,
  FileDeleteResponse,
  FileGetAssetsDirResponse,
  FileGetProjectsDirResponse,
  FileImportRequest,
  FileImportResponse,
  FileListRequest,
  FileListResponse,
  FileMoveRequest,
  FileMoveResponse,
  FileReadBinaryRequest,
  FileReadBinaryResponse,
  FileReadRequest,
  FileReadResponse,
  FileRenameRequest,
  FileRenameResponse,
  FileWriteRequest,
  FileWriteResponse,
} from '../../shared/ipc/types';

export const fileApi = {
  // ─── File operations ───
  // File operations
  fileList: (data?: FileListRequest): Promise<FileListResponse> =>
    ipcRenderer.invoke(IPC.FILE_LIST, data),
  fileRead: (data: FileReadRequest): Promise<FileReadResponse> =>
    ipcRenderer.invoke(IPC.FILE_READ, data),
  fileWrite: (data: FileWriteRequest): Promise<FileWriteResponse> =>
    ipcRenderer.invoke(IPC.FILE_WRITE, data),
  fileDelete: (data: FileDeleteRequest): Promise<FileDeleteResponse> =>
    ipcRenderer.invoke(IPC.FILE_DELETE, data),
  fileCreateFolder: (data: FileCreateFolderRequest): Promise<FileCreateFolderResponse> =>
    ipcRenderer.invoke(IPC.FILE_CREATE_FOLDER, data),
  fileImport: (data: FileImportRequest): Promise<FileImportResponse> =>
    ipcRenderer.invoke(IPC.FILE_IMPORT, data),
  fileRename: (data: FileRenameRequest): Promise<FileRenameResponse> =>
    ipcRenderer.invoke(IPC.FILE_RENAME, data),
  fileMove: (data: FileMoveRequest): Promise<FileMoveResponse> =>
    ipcRenderer.invoke(IPC.FILE_MOVE, data),
  fileGetProjectsDir: (): Promise<FileGetProjectsDirResponse> =>
    ipcRenderer.invoke(IPC.FILE_GET_PROJECTS_DIR),
  fileGetAssetsDir: (): Promise<FileGetAssetsDirResponse> =>
    ipcRenderer.invoke(IPC.FILE_GET_ASSETS_DIR),
  fileReadBinary: (data: FileReadBinaryRequest): Promise<FileReadBinaryResponse> =>
    ipcRenderer.invoke(IPC.FILE_READ_BINARY, data),
};
