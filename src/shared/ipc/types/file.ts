// ─── Tree node types (shared with workspace) ───
// Tree node types (shared with workspace)
export interface FileNode {
  id: string;
  name: string;
  type: 'file';
  path: string;
  mtimeMs: number;
}

export interface FolderNode {
  id: string;
  name: string;
  type: 'folder';
  path: string;
  children: TreeNode[];
  mtimeMs: number;
}

export type TreeNode = FileNode | FolderNode;

// ─── File operations ───
// File operations
export interface FileListRequest {
  path?: string;
  // Optional extension filter for FILE_LIST. Omit (or pass undefined) to keep the
  // legacy behavior of showing only .tsx/.html/.json/.png/.mp4 — every existing
  // caller relies on that default. The asset library passes '*' to see all files,
  // or an explicit list (e.g. ['.png', '.jpg']) to scope a view.
  extensions?: string[] | '*';
}
export interface FileListResponse {
  nodes: TreeNode[];
  error?: string;
}

export interface FileReadRequest {
  path: string;
}
export interface FileReadResponse {
  content: string;
  error?: string;
}

export interface FileWriteRequest {
  path: string;
  content: string;
}
export interface FileWriteResponse {
  success: boolean;
  error?: string;
}

export interface FileDeleteRequest {
  path: string;
  recursive?: boolean;
}
export interface FileDeleteResponse {
  success: boolean;
  error?: string;
}

export interface FileCreateFolderRequest {
  path: string;
}
export interface FileCreateFolderResponse {
  success: boolean;
  error?: string;
}

export interface FileImportRequest {
  sourcePaths: string[];
  targetFolder?: string;
}
export interface FileImportResponse {
  importedFiles: string[];
  error?: string;
}

// ─── File rename ───
// File rename
export interface FileRenameRequest {
  oldPath: string;
  newName: string;
}
export interface FileRenameResponse {
  success: boolean;
  newPath?: string;
  error?: string;
}

// ─── File move ───
// File move
export interface FileMoveRequest {
  sourcePath: string;
  targetFolderPath: string;
}
export interface FileMoveResponse {
  success: boolean;
  newPath?: string;
  error?: string;
}

// ─── File: get projects dir ───
// File get projects dir
export interface FileGetProjectsDirResponse {
  path: string;
}

// ─── File: get assets dir ───
// File get assets dir
export interface FileGetAssetsDirResponse {
  path: string;
}

// ─── Binary file read (for GLB, images, etc.) ───
// Binary file read (for GLB, images, etc.)
export interface FileReadBinaryRequest {
  path: string;
}
export interface FileReadBinaryResponse {
  data: string; // base64-encoded
  size: number; // file size in bytes
  error?: string;
}
