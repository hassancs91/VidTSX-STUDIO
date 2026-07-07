import type { IpcMainInvokeEvent } from 'electron';
import {
  listTranscriptionProjects,
  saveTranscriptionProject,
  loadTranscriptionProject,
  deleteTranscriptionProject,
} from '../services/transcription-projects-db';
import type {
  TranscriptionProjectListResponse,
  TranscriptionProjectSaveRequest,
  TranscriptionProjectSaveResponse,
  TranscriptionProjectLoadRequest,
  TranscriptionProjectLoadResponse,
  TranscriptionProjectDeleteRequest,
  TranscriptionProjectDeleteResponse,
} from '../../shared/ipc/types';

export async function handleTranscriptionProjectList(
  _event: IpcMainInvokeEvent,
): Promise<TranscriptionProjectListResponse> {
  try {
    const projects = await listTranscriptionProjects();
    return { success: true, projects };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to list transcription projects';
    return { success: false, error };
  }
}

export async function handleTranscriptionProjectSave(
  _event: IpcMainInvokeEvent,
  data: TranscriptionProjectSaveRequest,
): Promise<TranscriptionProjectSaveResponse> {
  try {
    await saveTranscriptionProject(data.project);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to save transcription project';
    return { success: false, error };
  }
}

export async function handleTranscriptionProjectLoad(
  _event: IpcMainInvokeEvent,
  data: TranscriptionProjectLoadRequest,
): Promise<TranscriptionProjectLoadResponse> {
  try {
    const project = await loadTranscriptionProject(data.id);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    return { success: true, project };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to load transcription project';
    return { success: false, error };
  }
}

export async function handleTranscriptionProjectDelete(
  _event: IpcMainInvokeEvent,
  data: TranscriptionProjectDeleteRequest,
): Promise<TranscriptionProjectDeleteResponse> {
  try {
    await deleteTranscriptionProject(data.id);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Failed to delete transcription project';
    return { success: false, error };
  }
}
