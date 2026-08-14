import { dialog, IpcMainInvokeEvent } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { getProjectsDir } from '../utils/paths';
import { ensureLibraryRoot } from '../services/library/library-paths';
import type {
  FileListRequest,
  FileListResponse,
  FileReadRequest,
  FileReadResponse,
  FileWriteRequest,
  FileWriteResponse,
  FileDeleteRequest,
  FileDeleteResponse,
  FileCreateFolderRequest,
  FileCreateFolderResponse,
  FileImportRequest,
  FileImportResponse,
  FileRenameRequest,
  FileRenameResponse,
  FileMoveRequest,
  FileMoveResponse,
  FileGetProjectsDirResponse,
  FileGetAssetsDirResponse,
  FileReadBinaryRequest,
  FileReadBinaryResponse,
  DialogOpenRequest,
  DialogOpenResponse,
  DialogSaveRequest,
  DialogSaveResponse,
  TreeNode,
  FileNode,
  FolderNode,
} from '../../shared/ipc/types';

const DEFAULT_FILE_EXTENSIONS = ['.tsx', '.html', '.json', '.png', '.mp4'];

function fileMatchesFilter(name: string, filter: string[] | '*'): boolean {
  if (filter === '*') return true;
  const lowered = name.toLowerCase();
  return filter.some((ext) => lowered.endsWith(ext.toLowerCase()));
}

async function buildTreeNode(
  itemPath: string,
  name: string,
  filter: string[] | '*'
): Promise<TreeNode | null> {
  try {
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      const children = await readDirectoryAsTree(itemPath, filter);
      const node: FolderNode = {
        id: itemPath,
        name,
        type: 'folder',
        path: itemPath,
        children,
        mtimeMs: stats.mtimeMs,
      };
      return node;
    } else if (stats.isFile() && fileMatchesFilter(name, filter)) {
      const node: FileNode = {
        id: itemPath,
        name,
        type: 'file',
        path: itemPath,
        mtimeMs: stats.mtimeMs,
      };
      return node;
    }
    return null;
  } catch {
    return null;
  }
}

async function readDirectoryAsTree(dirPath: string, filter: string[] | '*'): Promise<TreeNode[]> {
  try {
    const entries = await fs.readdir(dirPath);
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const node = await buildTreeNode(fullPath, entry, filter);
      if (node) {
        nodes.push(node);
      }
    }

    // Sort: folders first, then files, newest-modified first within each group
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return b.mtimeMs - a.mtimeMs;
    });

    return nodes;
  } catch {
    return [];
  }
}

export async function handleFileList(
  _event: IpcMainInvokeEvent,
  data?: FileListRequest
): Promise<FileListResponse> {
  try {
    const targetPath = data?.path ?? getProjectsDir();
    const filter = data?.extensions ?? DEFAULT_FILE_EXTENSIONS;
    const nodes = await readDirectoryAsTree(targetPath, filter);
    return { nodes };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list files';
    return { nodes: [], error };
  }
}

export async function handleFileRead(
  _event: IpcMainInvokeEvent,
  data: FileReadRequest
): Promise<FileReadResponse> {
  try {
    const content = await fs.readFile(data.path, 'utf-8');
    return { content };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to read file';
    return { content: '', error };
  }
}

export async function handleFileWrite(
  _event: IpcMainInvokeEvent,
  data: FileWriteRequest
): Promise<FileWriteResponse> {
  try {
    await fs.writeFile(data.path, data.content, 'utf-8');
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to write file';
    return { success: false, error };
  }
}

export async function handleFileDelete(
  _event: IpcMainInvokeEvent,
  data: FileDeleteRequest
): Promise<FileDeleteResponse> {
  try {
    await fs.rm(data.path, { recursive: data.recursive ?? false });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete file';
    return { success: false, error };
  }
}

export async function handleFileCreateFolder(
  _event: IpcMainInvokeEvent,
  data: FileCreateFolderRequest
): Promise<FileCreateFolderResponse> {
  try {
    await fs.mkdir(data.path, { recursive: true });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to create folder';
    return { success: false, error };
  }
}

export async function handleFileImport(
  _event: IpcMainInvokeEvent,
  data: FileImportRequest
): Promise<FileImportResponse> {
  try {
    const targetDir = data.targetFolder ?? getProjectsDir();
    const importedFiles: string[] = [];

    for (const sourcePath of data.sourcePaths) {
      const fileName = path.basename(sourcePath);
      const destPath = path.join(targetDir, fileName);

      // Check if file already exists, add suffix if needed
      let finalPath = destPath;
      let counter = 1;
      while (true) {
        try {
          await fs.access(finalPath);
          // File exists, try with a number suffix
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          finalPath = path.join(targetDir, `${base}_${counter}${ext}`);
          counter++;
        } catch {
          // File doesn't exist, we can use this path
          break;
        }
      }

      await fs.copyFile(sourcePath, finalPath);
      importedFiles.push(finalPath);
    }

    return { importedFiles };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to import files';
    return { importedFiles: [], error };
  }
}

export async function handleDialogOpen(
  _event: IpcMainInvokeEvent,
  data?: DialogOpenRequest
): Promise<DialogOpenResponse> {
  try {
    const result = await dialog.showOpenDialog({
      properties: [
        'openFile',
        ...(data?.multiSelections ? ['multiSelections' as const] : []),
      ],
      filters: data?.filters ?? [{ name: 'TSX Files', extensions: ['tsx'] }],
    });

    return {
      filePaths: result.filePaths,
      canceled: result.canceled,
    };
  } catch {
    return { filePaths: [], canceled: true };
  }
}

export async function handleDialogSave(
  _event: IpcMainInvokeEvent,
  data: DialogSaveRequest
): Promise<DialogSaveResponse> {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: data.defaultPath ?? data.defaultName,
      filters: data.filters ?? [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    // Write the file
    await fs.writeFile(result.filePath, data.content, 'utf-8');

    return { success: true, filePath: result.filePath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save file';
    return { success: false, error };
  }
}

export async function handleFileRename(
  _event: IpcMainInvokeEvent,
  data: FileRenameRequest
): Promise<FileRenameResponse> {
  try {
    const oldPath = data.oldPath;
    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, data.newName);

    // Check if target already exists
    try {
      await fs.access(newPath);
      return { success: false, error: 'A file with that name already exists' };
    } catch {
      // Good - doesn't exist, we can proceed
    }

    await fs.rename(oldPath, newPath);
    return { success: true, newPath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to rename';
    return { success: false, error };
  }
}

export async function handleFileMove(
  _event: IpcMainInvokeEvent,
  data: FileMoveRequest
): Promise<FileMoveResponse> {
  try {
    const { sourcePath, targetFolderPath } = data;
    const fileName = path.basename(sourcePath);
    const newPath = path.join(targetFolderPath, fileName);

    // Don't move to the same location
    if (path.dirname(sourcePath) === targetFolderPath) {
      return { success: true, newPath: sourcePath };
    }

    // Check if target already exists
    try {
      await fs.access(newPath);
      return { success: false, error: 'A file with that name already exists in the target folder' };
    } catch {
      // Good - doesn't exist, we can proceed
    }

    // Verify target is a directory
    const targetStats = await fs.stat(targetFolderPath);
    if (!targetStats.isDirectory()) {
      return { success: false, error: 'Target is not a folder' };
    }

    await fs.rename(sourcePath, newPath);
    return { success: true, newPath };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to move file';
    return { success: false, error };
  }
}

export async function handleFileReadBinary(
  _event: IpcMainInvokeEvent,
  data: FileReadBinaryRequest
): Promise<FileReadBinaryResponse> {
  try {
    const buffer = await fs.readFile(data.path);
    return { data: buffer.toString('base64'), size: buffer.length };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to read binary file';
    return { data: '', size: 0, error };
  }
}

export async function handleFileGetProjectsDir(): Promise<FileGetProjectsDirResponse> {
  return { path: getProjectsDir() };
}

export async function handleFileGetAssetsDir(): Promise<FileGetAssetsDirResponse> {
  // Honors the assets-root override (library-paths); the default is still
  // userData/assets via getAssetsDir().
  return { path: await ensureLibraryRoot() };
}

export const fileHandlers = {
  handleFileList,
  handleFileRead,
  handleFileWrite,
  handleFileDelete,
  handleFileCreateFolder,
  handleFileImport,
  handleDialogOpen,
  handleDialogSave,
  handleFileRename,
  handleFileMove,
  handleFileReadBinary,
  handleFileGetProjectsDir,
  handleFileGetAssetsDir,
};
