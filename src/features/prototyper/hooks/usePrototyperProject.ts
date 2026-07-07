import { useState, useCallback, useEffect } from 'react';
import type {
  PrototyperProject,
  PrototyperLibraryProject,
  PrototyperLibraryState,
  PrototyperChatMessage,
} from '../types';

export function usePrototyperProject() {
  const [project, setProject] = useState<PrototyperProject | null>(null);
  const [library, setLibrary] = useState<PrototyperLibraryState>({ folders: [], rootProjects: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listVersions = useCallback(async (folderPath: string): Promise<string[]> => {
    try {
      const result = await window.api.fileList({ path: folderPath });
      if (!result.nodes) return [];

      return result.nodes
        .filter((n) => n.type === 'file' && n.name.endsWith('.html'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => n.path);
    } catch {
      return [];
    }
  }, []);

  const listScreenshots = useCallback(async (folderPath: string): Promise<string[]> => {
    try {
      const result = await window.api.fileList({ path: folderPath });
      if (!result.nodes) return [];

      return result.nodes
        .filter((n) => n.type === 'file' && n.name.endsWith('.png'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => n.path);
    } catch {
      return [];
    }
  }, []);

  const listRecordings = useCallback(async (folderPath: string): Promise<string[]> => {
    try {
      const result = await window.api.fileList({ path: folderPath });
      if (!result.nodes) return [];

      return result.nodes
        .filter((n) => n.type === 'file' && n.name.endsWith('.mp4'))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((n) => n.path);
    } catch {
      return [];
    }
  }, []);

  const refreshLibrary = useCallback(async () => {
    try {
      const { path: projectsDir } = await window.api.fileGetProjectsDir();
      const result = await window.api.fileList({ path: projectsDir });
      if (!result.nodes) return;

      const rootProjects: PrototyperLibraryProject[] = [];

      for (const node of result.nodes) {
        if (node.type !== 'folder') continue;

        if (node.name.startsWith('prototype-')) {
          const versions = await listVersions(node.path);
          const screenshots = await listScreenshots(node.path);
          const recordings = await listRecordings(node.path);
          if (versions.length > 0) {
            rootProjects.push({ folderPath: node.path, name: node.name, versions, screenshots, recordings });
          }
        }
      }

      rootProjects.sort((a, b) => b.name.localeCompare(a.name));
      setLibrary({ folders: [], rootProjects });
    } catch {
      // Silently fail
    }
  }, [listVersions, listScreenshots, listRecordings]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const saveChatHistory = useCallback(async (folderPath: string, chatHistory: PrototyperChatMessage[]) => {
    const chatPath = `${folderPath}/chat.json`;
    await window.api.fileWrite({ path: chatPath, content: JSON.stringify(chatHistory, null, 2) });
  }, []);

  const loadChatHistory = useCallback(async (folderPath: string): Promise<PrototyperChatMessage[]> => {
    try {
      const chatPath = `${folderPath}/chat.json`;
      const result = await window.api.fileRead({ path: chatPath });
      if (result.error || !result.content) return [];
      return JSON.parse(result.content) as PrototyperChatMessage[];
    } catch {
      return [];
    }
  }, []);

  const createProject = useCallback(async (
    html: string,
    chatHistory: PrototyperChatMessage[]
  ): Promise<PrototyperProject | null> => {
    setLoading(true);
    setError(null);

    try {
      const { path: projectsDir } = await window.api.fileGetProjectsDir();
      const folderName = `prototype-${Date.now()}`;
      const folderPath = `${projectsDir}/${folderName}`;

      await window.api.fileCreateFolder({ path: folderPath });

      const versionPath = `${folderPath}/v1.html`;
      const writeResult = await window.api.fileWrite({ path: versionPath, content: html });

      if (!writeResult.success) {
        setError(writeResult.error || 'Failed to save file');
        return null;
      }

      await saveChatHistory(folderPath, chatHistory);

      const newProject: PrototyperProject = {
        folderPath,
        name: folderName,
        versions: [versionPath],
        currentVersion: versionPath,
        currentHtml: html,
        chatHistory,
      };

      setProject(newProject);
      await refreshLibrary();
      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshLibrary, saveChatHistory]);

  const saveNewVersion = useCallback(async (
    html: string,
    chatHistory: PrototyperChatMessage[]
  ): Promise<string | null> => {
    if (!project) return null;
    setLoading(true);
    setError(null);

    try {
      const versions = await listVersions(project.folderPath);
      const nextNum = versions.length + 1;
      const versionPath = `${project.folderPath}/v${nextNum}.html`;

      const result = await window.api.fileWrite({ path: versionPath, content: html });
      if (!result.success) {
        setError(result.error || 'Failed to save version');
        return null;
      }

      await saveChatHistory(project.folderPath, chatHistory);

      const updatedVersions = [...versions, versionPath];
      setProject({
        ...project,
        versions: updatedVersions,
        currentVersion: versionPath,
        currentHtml: html,
        chatHistory,
      });

      await refreshLibrary();
      return versionPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save version');
      return null;
    } finally {
      setLoading(false);
    }
  }, [project, listVersions, refreshLibrary, saveChatHistory]);

  const overwriteVersion = useCallback(async (html: string): Promise<boolean> => {
    if (!project) return false;
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.fileWrite({
        path: project.currentVersion,
        content: html,
      });

      if (!result.success) {
        setError(result.error || 'Failed to overwrite');
        return false;
      }

      setProject({ ...project, currentHtml: html });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to overwrite');
      return false;
    } finally {
      setLoading(false);
    }
  }, [project]);

  const loadVersion = useCallback(async (filePath: string, folderPath: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.fileRead({ path: filePath });
      if (result.error) {
        setError(result.error);
        return;
      }

      const chatHistory = await loadChatHistory(folderPath);
      const versions = await listVersions(folderPath);
      const name = folderPath.split(/[/\\]/).pop() || folderPath;

      setProject({
        folderPath,
        name,
        versions,
        currentVersion: filePath,
        currentHtml: result.content,
        chatHistory,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setLoading(false);
    }
  }, [listVersions, loadChatHistory]);

  const renameProject = useCallback(async (folderPath: string, newName: string): Promise<boolean> => {
    try {
      const result = await window.api.fileRename({ oldPath: folderPath, newName });
      if (!result.success) {
        setError(result.error || 'Failed to rename project');
        return false;
      }
      if (project && project.folderPath === folderPath && result.newPath) {
        const versions = await listVersions(result.newPath);
        const currentFileName = project.currentVersion.split(/[/\\]/).pop() || '';
        const chatHistory = await loadChatHistory(result.newPath);
        setProject({
          ...project,
          folderPath: result.newPath,
          name: newName,
          versions,
          currentVersion: versions.find((v) => v.endsWith(currentFileName)) || versions[0] || project.currentVersion,
          chatHistory,
        });
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project');
      return false;
    }
  }, [project, listVersions, refreshLibrary, loadChatHistory]);

  const deleteProject = useCallback(async (folderPath: string): Promise<boolean> => {
    try {
      const result = await window.api.fileDelete({ path: folderPath, recursive: true });
      if (!result.success) {
        setError(result.error || 'Failed to delete project');
        return false;
      }
      if (project && project.folderPath === folderPath) {
        setProject(null);
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      return false;
    }
  }, [project, refreshLibrary]);

  const saveScreenshot = useCallback(async (
    html: string,
    width: number,
    height: number,
  ): Promise<string | null> => {
    if (!project) return null;
    setError(null);

    try {
      const screenshots = await listScreenshots(project.folderPath);
      const nextNum = screenshots.length + 1;
      const filePath = `${project.folderPath}/screenshot-${nextNum}.png`;

      const result = await window.api.screenshotCaptureHtml({ html, width, height, filePath });
      if (!result.success) {
        setError(result.error || 'Failed to save screenshot');
        return null;
      }

      await refreshLibrary();
      return result.filePath || filePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save screenshot');
      return null;
    }
  }, [project, listScreenshots, refreshLibrary]);

  const startRecording = useCallback(async (
    html: string,
    width: number,
    height: number,
  ): Promise<boolean> => {
    if (!project) return false;
    setError(null);

    try {
      const recordings = await listRecordings(project.folderPath);
      const nextNum = recordings.length + 1;
      const filePath = `${project.folderPath}/recording-${nextNum}.mp4`;

      const result = await window.api.prototyperRecordStart({ html, width, height, filePath });
      if (!result.success) {
        setError(result.error || 'Failed to start recording');
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      return false;
    }
  }, [project, listRecordings]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    setError(null);

    try {
      const result = await window.api.prototyperRecordStop();
      if (!result.success) {
        setError(result.error || 'Failed to stop recording');
        return null;
      }

      await refreshLibrary();
      return result.filePath || null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
      return null;
    }
  }, [refreshLibrary]);

  const resetProject = useCallback(() => {
    setProject(null);
    setError(null);
  }, []);

  return {
    project,
    library,
    loading,
    error,
    createProject,
    loadVersion,
    saveNewVersion,
    overwriteVersion,
    refreshLibrary,
    saveScreenshot,
    startRecording,
    stopRecording,
    renameProject,
    deleteProject,
    resetProject,
  };
}
