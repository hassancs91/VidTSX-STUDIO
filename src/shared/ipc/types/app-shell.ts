// ─── App operations ───
// App operations
export interface AppGetInfoResponse {
  version: string;
  name: string;
}

export interface AppOpenExternalRequest {
  url: string;
}

export interface AppOpenExternalResponse {
  success: boolean;
  error?: string;
}

export interface AppGetIsDevResponse {
  isDev: boolean;
}

// ─── Dialog operations ───
// Dialog operations
export interface DialogOpenRequest {
  filters?: { name: string; extensions: string[] }[];
  multiSelections?: boolean;
}
export interface DialogOpenResponse {
  filePaths: string[];
  canceled: boolean;
}

export interface DialogSaveRequest {
  defaultPath?: string;
  defaultName?: string;
  filters?: { name: string; extensions: string[] }[];
  content: string;
}

export interface DialogSaveResponse {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

// ─── Dialog: open folder ───
export interface DialogOpenFolderResponse {
  folderPath: string | null;
  canceled: boolean;
}

// ─── Context menu ───
// Context menu
export type ContextMenuTarget =
  | { type: 'file'; path: string; name: string }
  | { type: 'folder'; path: string; name: string };

export interface ContextMenuShowRequest {
  target: ContextMenuTarget;
}

export type ContextMenuAction = 'rename' | 'delete' | 'new-subfolder';

export interface ContextMenuShowResponse {
  action: ContextMenuAction | null;
}

// ─── Clipboard ───
// Clipboard
export interface ClipboardReadTextResponse {
  text: string;
}

// ─── Screenshot operations ───
// Screenshot operations
export interface ScreenshotCopyRequest {
  dataUrl: string;
}
export interface ScreenshotCopyResponse {
  success: boolean;
  error?: string;
}
export interface ScreenshotSaveRequest {
  dataUrl: string;
  fileName?: string;
}
export interface ScreenshotSaveResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface ScreenshotSaveToPathRequest {
  dataUrl: string;
  filePath: string;
}
export interface ScreenshotSaveToPathResponse {
  success: boolean;
  filePath?: string;
  error?: string;
}
