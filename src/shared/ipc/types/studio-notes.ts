// Studio — project notes (video-10 import gap 7, go-live step 3a): plain
// Markdown files under `<project>/notes/`, folder-as-truth. The Notes tab
// edits them; the assistant reads them through `list_notes` / `read_note`.
// Anything else (an import report, a QA pass, a plan) can drop a file there.

export interface StudioNoteInfo {
  /** File name including `.md`, e.g. `IMPORT-REPORT.md`. */
  name: string;
  size: number;
  /** mtime, ms since epoch. */
  updatedAt: number;
}

export interface StudioNotesListRequest {
  projectId: string;
}

export interface StudioNotesListResponse {
  success: boolean;
  notes?: StudioNoteInfo[];
  error?: string;
}

export interface StudioNoteReadRequest {
  projectId: string;
  name: string;
}

export interface StudioNoteReadResponse {
  success: boolean;
  text?: string;
  error?: string;
}

export interface StudioNoteWriteRequest {
  projectId: string;
  /** With or without `.md`; validated in main (no separators, no dots-only names). */
  name: string;
  text: string;
}

export interface StudioNoteWriteResponse {
  success: boolean;
  note?: StudioNoteInfo;
  error?: string;
}

export interface StudioNoteDeleteRequest {
  projectId: string;
  name: string;
}

export interface StudioNoteDeleteResponse {
  success: boolean;
  error?: string;
}
