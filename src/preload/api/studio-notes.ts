import { ipcRenderer } from 'electron';
import { IPC } from '../../shared/ipc/channels';
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

export const studioNotesApi = {
  // ─── Studio — project notes (notes/*.md, video-10 gap 7) ───
  studioNotesList: (data: StudioNotesListRequest): Promise<StudioNotesListResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_NOTES_LIST, data),
  studioNoteRead: (data: StudioNoteReadRequest): Promise<StudioNoteReadResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_NOTE_READ, data),
  studioNoteWrite: (data: StudioNoteWriteRequest): Promise<StudioNoteWriteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_NOTE_WRITE, data),
  studioNoteDelete: (data: StudioNoteDeleteRequest): Promise<StudioNoteDeleteResponse> =>
    ipcRenderer.invoke(IPC.STUDIO_NOTE_DELETE, data),
};
