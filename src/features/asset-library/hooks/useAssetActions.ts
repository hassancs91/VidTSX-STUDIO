import { useCallback } from 'react';
import { useToast } from '@renderer/contexts/ToastContext';

interface UseAssetActionsParams {
  currentPath: string;
  onChanged: () => void | Promise<void>;
}

export function useAssetActions({ currentPath, onChanged }: UseAssetActionsParams) {
  const { showToast } = useToast();

  const importFiles = useCallback(async () => {
    const dialog = await window.api.dialogOpen({
      multiSelections: true,
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });
    if (dialog.canceled || dialog.filePaths.length === 0) return;
    const res = await window.api.fileImport({
      sourcePaths: dialog.filePaths,
      targetFolder: currentPath,
    });
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(`Imported ${res.importedFiles.length} file${res.importedFiles.length === 1 ? '' : 's'}`, 'success');
    await onChanged();
  }, [currentPath, onChanged, showToast]);

  const createFolder = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const sep = currentPath.includes('\\') ? '\\' : '/';
    const target = currentPath.replace(/[\\/]$/, '') + sep + trimmed;
    const res = await window.api.fileCreateFolder({ path: target });
    if (!res.success) {
      showToast(res.error ?? 'Failed to create folder', 'error');
      return;
    }
    await onChanged();
  }, [currentPath, onChanged, showToast]);

  const renameNode = useCallback(async (oldPath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const res = await window.api.fileRename({ oldPath, newName: trimmed });
    if (!res.success) {
      showToast(res.error ?? 'Failed to rename', 'error');
      return;
    }
    await onChanged();
  }, [onChanged, showToast]);

  const moveNode = useCallback(async (sourcePath: string, targetFolderPath: string) => {
    if (sourcePath === targetFolderPath) return;
    const res = await window.api.fileMove({ sourcePath, targetFolderPath });
    if (!res.success) {
      showToast(res.error ?? 'Failed to move', 'error');
      return;
    }
    await onChanged();
  }, [onChanged, showToast]);

  const deleteNode = useCallback(async (targetPath: string, recursive: boolean) => {
    const res = await window.api.fileDelete({ path: targetPath, recursive });
    if (!res.success) {
      showToast(res.error ?? 'Failed to delete', 'error');
      return;
    }
    await onChanged();
  }, [onChanged, showToast]);

  return { importFiles, createFolder, renameNode, moveNode, deleteNode };
}
