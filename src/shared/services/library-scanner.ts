import type { LibraryProject, LibraryState } from '@shared/types/library';

async function listVersions(folderPath: string): Promise<string[]> {
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
}

export async function scanLibrary(): Promise<LibraryState> {
  try {
    const { path: projectsDir } = await window.api.fileGetProjectsDir();
    const result = await window.api.fileList({ path: projectsDir });
    if (!result.nodes) return { folders: [], rootProjects: [] };

    const rootProjects: LibraryProject[] = [];
    const folders: { folderPath: string; name: string; projects: LibraryProject[]; mtimeMs: number }[] = [];

    for (const node of result.nodes) {
      if (node.type !== 'folder') continue;

      const versions = await listVersions(node.path);
      if (versions.length > 0) {
        rootProjects.push({ folderPath: node.path, name: node.name, versions, mtimeMs: node.mtimeMs });
      } else {
        const childResult = await window.api.fileList({ path: node.path });
        const folderProjects: LibraryProject[] = [];

        for (const child of childResult.nodes || []) {
          if (child.type === 'folder') {
            const childVersions = await listVersions(child.path);
            if (childVersions.length > 0) {
              folderProjects.push({ folderPath: child.path, name: child.name, versions: childVersions, mtimeMs: child.mtimeMs });
            }
          }
        }

        folders.push({ folderPath: node.path, name: node.name, projects: folderProjects, mtimeMs: node.mtimeMs });
      }
    }

    rootProjects.sort((a, b) => b.mtimeMs - a.mtimeMs);
    folders.sort((a, b) => b.mtimeMs - a.mtimeMs);
    folders.forEach((f) => f.projects.sort((a, b) => b.mtimeMs - a.mtimeMs));

    return { folders, rootProjects };
  } catch {
    return { folders: [], rootProjects: [] };
  }
}
