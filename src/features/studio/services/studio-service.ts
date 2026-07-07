import type { VideoMetadata, StudioProjectData } from '../types';
import { DEFAULT_STUDIO_COMPOSITION } from '@shared/ipc/types';

// --- Video operations ---

export async function openVideoFile(): Promise<string | null> {
  const result = await window.api.dialogOpen({
    filters: [{ name: 'Video Files', extensions: ['mp4'] }],
  });

  if (!result.filePaths || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

export async function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  const response = await window.api.studioFfprobe({ filePath });

  if (!response.success || !response.metadata) {
    throw new Error(response.error ?? 'Failed to read video metadata');
  }

  return response.metadata;
}

export async function getVideoUrl(filePath: string): Promise<string> {
  const response = await window.api.moduleServerUrl();

  if (!response.url) {
    throw new Error('Module server is not running');
  }

  return `${response.url}/asset?path=${encodeURIComponent(filePath)}`;
}

// --- Project operations ---

export function generateProjectId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function generateProjectName(fileName: string, id: string): string {
  const name = fileName.replace(/\.[^.]+$/, '');
  return `${name}-${id.slice(0, 4)}`;
}

export function createEmptyProjectData(): StudioProjectData {
  const id = generateProjectId();
  const now = Date.now();
  return {
    id,
    name: `Untitled-${id.slice(0, 4)}`,
    composition: { ...DEFAULT_STUDIO_COMPOSITION },
    createdAt: now,
    updatedAt: now,
  };
}

export async function fetchProjectList(): Promise<StudioProjectData[]> {
  const response = await window.api.studioProjectList();
  if (!response.success || !response.projects) {
    return [];
  }
  return response.projects;
}

export async function saveProject(project: StudioProjectData): Promise<void> {
  const response = await window.api.studioProjectSave({ project });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to save project');
  }
}

export async function loadProject(id: string): Promise<StudioProjectData> {
  const response = await window.api.studioProjectLoad({ id });
  if (!response.success || !response.project) {
    throw new Error(response.error ?? 'Project not found');
  }
  return response.project;
}

export async function deleteProject(id: string): Promise<void> {
  const response = await window.api.studioProjectDelete({ id });
  if (!response.success) {
    throw new Error(response.error ?? 'Failed to delete project');
  }
}
