import { useState, useCallback, useEffect } from 'react';
import type { MotionProject, LibraryState } from '../types';
import { scanLibrary } from '@shared/services/library-scanner';

export function getNextUniqueName(baseName: string, library: LibraryState): string {
  const allNames = [
    ...library.rootProjects.map((p) => p.name),
    ...library.folders.flatMap((f) => f.projects.map((p) => p.name)),
  ];

  if (!allNames.includes(baseName)) return baseName;

  let counter = 2;
  let candidate = `${baseName}-${counter}`;
  while (allNames.includes(candidate)) {
    counter++;
    candidate = `${baseName}-${counter}`;
  }
  return candidate;
}

export function useMotionProject() {
  const [project, setProject] = useState<MotionProject | null>(null);
  const [library, setLibrary] = useState<LibraryState>({ folders: [], rootProjects: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listVersions = useCallback(async (folderPath: string): Promise<string[]> => {
    try {
      const result = await window.api.fileList({ path: folderPath });
      if (!result.nodes) return [];

      return result.nodes
        .filter((n) => n.type === 'file' && n.name.endsWith('.tsx'))
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .map((n) => n.path);
    } catch {
      return [];
    }
  }, []);

  const refreshLibrary = useCallback(async () => {
    const result = await scanLibrary();
    setLibrary(result);
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const createProject = useCallback(async (content: string, parentFolder?: string, projectName?: string, opts?: { setActive?: boolean; skipRefresh?: boolean }): Promise<MotionProject | null> => {
    const setActive = opts?.setActive ?? true;
    const skipRefresh = opts?.skipRefresh ?? false;
    setLoading(true);
    setError(null);

    try {
      const { path: projectsDir } = await window.api.fileGetProjectsDir();
      const baseDir = parentFolder || projectsDir;
      const folderName = projectName || `motion-${Date.now()}`;
      const folderPath = `${baseDir}/${folderName}`;

      await window.api.fileCreateFolder({ path: folderPath });

      const versionPath = `${folderPath}/v1.tsx`;
      const writeResult = await window.api.fileWrite({ path: versionPath, content });

      if (!writeResult.success) {
        setError(writeResult.error || 'Failed to save file');
        return null;
      }

      const newProject: MotionProject = {
        folderPath,
        name: folderName,
        versions: [versionPath],
        currentVersion: versionPath,
        currentContent: content,
      };

      if (setActive) {
        setProject(newProject);
      }
      if (!skipRefresh) {
        await refreshLibrary();
      }
      return newProject;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshLibrary]);

  const loadVersion = useCallback(async (filePath: string, folderPath?: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.fileRead({ path: filePath });
      if (result.error) {
        setError(result.error);
        return;
      }

      if (folderPath && (!project || project.folderPath !== folderPath)) {
        const versions = await listVersions(folderPath);
        const name = folderPath.split(/[/\\]/).pop() || folderPath;
        setProject({
          folderPath,
          name,
          versions,
          currentVersion: filePath,
          currentContent: result.content,
        });
      } else {
        setProject((prev) => {
          if (!prev) return prev;
          return { ...prev, currentVersion: filePath, currentContent: result.content };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setLoading(false);
    }
  }, [project, listVersions]);

  const saveNewVersion = useCallback(async (content: string): Promise<string | null> => {
    if (!project) return null;
    setLoading(true);
    setError(null);

    try {
      const versions = await listVersions(project.folderPath);
      const nextNum = versions.length + 1;
      const versionPath = `${project.folderPath}/v${nextNum}.tsx`;

      const result = await window.api.fileWrite({ path: versionPath, content });
      if (!result.success) {
        setError(result.error || 'Failed to save version');
        return null;
      }

      const updatedVersions = [...versions, versionPath];
      setProject({
        ...project,
        versions: updatedVersions,
        currentVersion: versionPath,
        currentContent: content,
      });

      await refreshLibrary();
      return versionPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save version');
      return null;
    } finally {
      setLoading(false);
    }
  }, [project, listVersions, refreshLibrary]);

  const overwriteVersion = useCallback(async (content: string): Promise<boolean> => {
    if (!project) return false;
    setLoading(true);
    setError(null);

    try {
      const result = await window.api.fileWrite({
        path: project.currentVersion,
        content,
      });

      if (!result.success) {
        setError(result.error || 'Failed to overwrite');
        return false;
      }

      setProject({ ...project, currentContent: content });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to overwrite');
      return false;
    } finally {
      setLoading(false);
    }
  }, [project]);

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
        setProject({
          ...project,
          folderPath: result.newPath,
          name: newName,
          versions,
          currentVersion: versions.find((v) => v.endsWith(currentFileName)) || versions[0] || project.currentVersion,
        });
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project');
      return false;
    }
  }, [project, listVersions, refreshLibrary]);

  const renameVersion = useCallback(async (filePath: string, newName: string): Promise<boolean> => {
    try {
      const result = await window.api.fileRename({ oldPath: filePath, newName });
      if (!result.success) {
        setError(result.error || 'Failed to rename file');
        return false;
      }
      if (project && project.currentVersion === filePath && result.newPath) {
        const versions = await listVersions(project.folderPath);
        setProject({ ...project, versions, currentVersion: result.newPath });
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename file');
      return false;
    }
  }, [project, listVersions, refreshLibrary]);

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

  const deleteVersion = useCallback(async (filePath: string, projectFolderPath: string): Promise<boolean> => {
    try {
      const result = await window.api.fileDelete({ path: filePath });
      if (!result.success) {
        setError(result.error || 'Failed to delete version');
        return false;
      }

      // If the deleted version was the active one, switch to another or clear
      if (project && project.folderPath === projectFolderPath) {
        const remaining = await listVersions(projectFolderPath);
        if (remaining.length === 0) {
          setProject(null);
        } else if (project.currentVersion === filePath) {
          const content = await window.api.fileRead({ path: remaining[0] });
          setProject({
            ...project,
            versions: remaining,
            currentVersion: remaining[0],
            currentContent: content.error ? '' : content.content,
          });
        } else {
          setProject({ ...project, versions: remaining });
        }
      }

      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete version');
      return false;
    }
  }, [project, listVersions, refreshLibrary]);

  const createFolder = useCallback(async (name: string): Promise<boolean> => {
    try {
      const safeName = name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/[. ]+$/, '')
        .trim();
      if (!safeName) {
        setError('Folder name is empty after removing invalid characters');
        return false;
      }
      const { path: projectsDir } = await window.api.fileGetProjectsDir();
      const folderPath = `${projectsDir}/${safeName}`;
      const result = await window.api.fileCreateFolder({ path: folderPath });
      if (!result.success) {
        setError(result.error || 'Failed to create folder');
        return false;
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create folder');
      return false;
    }
  }, [refreshLibrary]);

  const renameFolder = useCallback(async (folderPath: string, newName: string): Promise<boolean> => {
    try {
      const result = await window.api.fileRename({ oldPath: folderPath, newName });
      if (!result.success) {
        setError(result.error || 'Failed to rename folder');
        return false;
      }
      // If active project is inside this folder, update its path
      if (project && result.newPath) {
        const oldPrefix = folderPath.replace(/\\/g, '/');
        const projectDir = project.folderPath.replace(/\\/g, '/');
        if (projectDir.startsWith(oldPrefix + '/')) {
          const newPrefix = result.newPath.replace(/\\/g, '/');
          const suffix = projectDir.slice(oldPrefix.length);
          const newProjectPath = newPrefix + suffix;
          const versions = await listVersions(newProjectPath);
          const currentFileName = project.currentVersion.split(/[/\\]/).pop() || '';
          setProject({
            ...project,
            folderPath: newProjectPath,
            versions,
            currentVersion: versions.find((v) => v.endsWith(currentFileName)) || versions[0] || project.currentVersion,
          });
        }
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename folder');
      return false;
    }
  }, [project, listVersions, refreshLibrary]);

  const deleteFolder = useCallback(async (folderPath: string): Promise<boolean> => {
    try {
      const result = await window.api.fileDelete({ path: folderPath, recursive: true });
      if (!result.success) {
        setError(result.error || 'Failed to delete folder');
        return false;
      }
      // If active project was inside this folder, clear it
      if (project) {
        const oldPrefix = folderPath.replace(/\\/g, '/');
        const projectDir = project.folderPath.replace(/\\/g, '/');
        if (projectDir.startsWith(oldPrefix + '/') || projectDir === oldPrefix) {
          setProject(null);
        }
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete folder');
      return false;
    }
  }, [project, refreshLibrary]);

  const moveProject = useCallback(async (projectPath: string, targetFolderPath: string): Promise<boolean> => {
    try {
      const result = await window.api.fileMove({ sourcePath: projectPath, targetFolderPath });
      if (!result.success) {
        setError(result.error || 'Failed to move project');
        return false;
      }
      if (project && project.folderPath === projectPath && result.newPath) {
        const versions = await listVersions(result.newPath);
        const currentFileName = project.currentVersion.split(/[/\\]/).pop() || '';
        setProject({
          ...project,
          folderPath: result.newPath,
          versions,
          currentVersion: versions.find((v) => v.endsWith(currentFileName)) || versions[0] || project.currentVersion,
        });
      }
      await refreshLibrary();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move project');
      return false;
    }
  }, [project, listVersions, refreshLibrary]);

  const moveProjectToRoot = useCallback(async (projectPath: string): Promise<boolean> => {
    try {
      const { path: projectsDir } = await window.api.fileGetProjectsDir();
      return await moveProject(projectPath, projectsDir);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move project');
      return false;
    }
  }, [moveProject]);

  const importProject = useCallback(async (parentFolder?: string): Promise<MotionProject | null> => {
    try {
      const dialog = await window.api.dialogOpen({
        filters: [{ name: 'TSX Files', extensions: ['tsx'] }],
        multiSelections: true,
      });
      if (dialog.canceled || dialog.filePaths.length === 0) return null;

      const takenNames = new Set<string>([
        ...library.rootProjects.map((p) => p.name),
        ...library.folders.flatMap((f) => f.projects.map((p) => p.name)),
      ]);
      const reserveUniqueName = (baseName: string): string => {
        let counter = 1;
        let candidate = `${baseName}-${counter}`;
        while (takenNames.has(candidate)) {
          counter++;
          candidate = `${baseName}-${counter}`;
        }
        takenNames.add(candidate);
        return candidate;
      };

      const isBulk = dialog.filePaths.length > 1;
      const failures: string[] = [];
      let firstImported: MotionProject | null = null;
      let lastImported: MotionProject | null = null;

      for (const filePath of dialog.filePaths) {
        const fileResult = await window.api.fileRead({ path: filePath });
        if (fileResult.error) {
          failures.push(`${filePath.split(/[/\\]/).pop()}: ${fileResult.error}`);
          continue;
        }

        const baseName = filePath.split(/[/\\]/).pop()?.replace(/\.tsx$/i, '') || 'import';
        const uniqueName = reserveUniqueName(baseName);
        const imported = await createProject(fileResult.content, parentFolder, uniqueName, {
          setActive: !isBulk,
          skipRefresh: true,
        });
        if (imported) {
          if (!firstImported) firstImported = imported;
          lastImported = imported;
        } else {
          failures.push(baseName);
        }
      }

      await refreshLibrary();

      if (failures.length > 0) {
        setError(`Failed to import ${failures.length} file(s): ${failures.slice(0, 3).join(', ')}${failures.length > 3 ? '…' : ''}`);
      }

      return isBulk ? firstImported : lastImported;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file');
      return null;
    }
  }, [createProject, library, refreshLibrary]);

  const createEmptyProject = useCallback(async (parentFolder?: string): Promise<MotionProject | null> => {
    const template = `import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

export const fps = 30;
export const durationInFrames = 150;
export const width = 1920;
export const height = 1080;

export default function MyComposition() {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const opacity = Math.min(1, frame / 30);

  return (
    <AbsoluteFill style={{ backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
      <h1 style={{ color: '#fff', fontSize: 72, fontFamily: 'sans-serif', opacity }}>
        New Composition
      </h1>
      <p style={{ color: '#888', fontSize: 24, fontFamily: 'sans-serif', position: 'absolute', bottom: height * 0.15 }}>
        {width}x{height} | {Math.round(frame)} frames
      </p>
    </AbsoluteFill>
  );
}
`;
    const uniqueName = getNextUniqueName('new', library);
    return await createProject(template, parentFolder, uniqueName);
  }, [createProject, library]);

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
    renameProject,
    renameVersion,
    deleteProject,
    deleteVersion,
    createFolder,
    renameFolder,
    deleteFolder,
    moveProject,
    moveProjectToRoot,
    importProject,
    createEmptyProject,
  };
}
