// Project notes IPC (video-10 import gap 7) — thin wrappers over
// services/studio/project-notes.ts. Names are validated there; the renderer
// only ever sees names and text.

import type { IpcMainInvokeEvent } from 'electron';
import type {
  StudioNoteDeleteRequest,
  StudioNoteDeleteResponse,
  StudioNoteReadRequest,
  StudioNoteReadResponse,
  StudioNoteWriteRequest,
  StudioNoteWriteResponse,
  StudioNotesListRequest,
  StudioNotesListResponse,
} from '../../shared/ipc/types';
import { deleteNote, listNotes, readNote, writeNote } from '../services/studio/project-notes';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export async function handleStudioNotesList(
  _event: IpcMainInvokeEvent,
  data: StudioNotesListRequest,
): Promise<StudioNotesListResponse> {
  try {
    return { success: true, notes: await listNotes(data.projectId) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to list notes') };
  }
}

export async function handleStudioNoteRead(
  _event: IpcMainInvokeEvent,
  data: StudioNoteReadRequest,
): Promise<StudioNoteReadResponse> {
  try {
    return { success: true, text: await readNote(data.projectId, data.name) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to read note') };
  }
}

export async function handleStudioNoteWrite(
  _event: IpcMainInvokeEvent,
  data: StudioNoteWriteRequest,
): Promise<StudioNoteWriteResponse> {
  try {
    if (typeof data.text !== 'string') return { success: false, error: 'text must be a string' };
    return { success: true, note: await writeNote(data.projectId, data.name, data.text) };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to save note') };
  }
}

export async function handleStudioNoteDelete(
  _event: IpcMainInvokeEvent,
  data: StudioNoteDeleteRequest,
): Promise<StudioNoteDeleteResponse> {
  try {
    await deleteNote(data.projectId, data.name);
    return { success: true };
  } catch (err) {
    return { success: false, error: errorMessage(err, 'Failed to delete note') };
  }
}
