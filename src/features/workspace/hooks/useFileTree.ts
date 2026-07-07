import { useState, useEffect, useCallback } from 'react';
import type { TreeNode } from '../types';

export function useFileTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await window.api.fileList();
      if (response.error) {
        setError(response.error);
      } else {
        setNodes(response.nodes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  }, []);

  const importFiles = useCallback(async () => {
    try {
      const dialogResult = await window.api.dialogOpen({
        filters: [{ name: 'TSX Files', extensions: ['tsx'] }],
        multiSelections: true,
      });

      if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
        return;
      }

      const importResult = await window.api.fileImport({
        sourcePaths: dialogResult.filePaths,
      });

      if (importResult.error) {
        setError(importResult.error);
        return;
      }

      // Refresh the file list after import
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import files');
    }
  }, [loadFiles]);

  const refresh = useCallback(() => {
    loadFiles();
  }, [loadFiles]);

  const createFolder = useCallback(
    async (name: string, parentPath?: string) => {
      try {
        const { path: projectsDir } = await window.api.fileGetProjectsDir();
        const basePath = parentPath ?? projectsDir;
        const fullPath = basePath + '/' + name;

        const result = await window.api.fileCreateFolder({ path: fullPath });
        if (result.error) {
          setError(result.error);
          return result;
        }

        await loadFiles();
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create folder';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [loadFiles]
  );

  const renameItem = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        const result = await window.api.fileRename({ oldPath, newName });
        if (result.error) {
          setError(result.error);
          return result;
        }

        await loadFiles();
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to rename';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [loadFiles]
  );

  const deleteItem = useCallback(
    async (path: string, recursive = false) => {
      try {
        const result = await window.api.fileDelete({ path, recursive });
        if (result.error) {
          setError(result.error);
          return result;
        }

        await loadFiles();
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [loadFiles]
  );

  const moveItem = useCallback(
    async (sourcePath: string, targetFolderPath: string) => {
      try {
        const result = await window.api.fileMove({ sourcePath, targetFolderPath });
        if (result.error) {
          setError(result.error);
          return result;
        }

        await loadFiles();
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to move';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [loadFiles]
  );

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return {
    nodes,
    loading,
    error,
    refresh,
    importFiles,
    createFolder,
    renameItem,
    deleteItem,
    moveItem,
  };
}
