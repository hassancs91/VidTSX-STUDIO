import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudioNoteInfo } from '@shared/ipc/types';

const SAVE_DEBOUNCE_MS = 600;

/**
 * The Notes tab's state (video-10 gap 7): the list of `notes/*.md`, the open
 * note's text, debounced saves through the notes IPC. Files are the truth —
 * reload re-reads the folder, so a note another tool dropped in appears.
 */
export function useProjectNotes(projectId: string) {
  const [notes, setNotes] = useState<StudioNoteInfo[]>([]);
  const [openName, setOpenName] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const res = await window.api.studioNotesList({ projectId });
    if (res.success && res.notes) setNotes(res.notes);
    else setError(res.error ?? 'Failed to list notes');
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = useCallback(
    async (name: string) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      setStatus('loading');
      setError(null);
      const res = await window.api.studioNoteRead({ projectId, name });
      if (res.success) {
        setOpenName(name);
        setText(res.text ?? '');
        setStatus('idle');
      } else {
        setStatus('error');
        setError(res.error ?? 'Failed to read note');
      }
    },
    [projectId],
  );

  const flush = useCallback(
    async (name: string, value: string) => {
      setStatus('saving');
      const res = await window.api.studioNoteWrite({ projectId, name, text: value });
      if (res.success) {
        setStatus('saved');
        setError(null);
        await reload();
      } else {
        setStatus('error');
        setError(res.error ?? 'Failed to save note');
      }
    },
    [projectId, reload],
  );

  const edit = useCallback(
    (value: string) => {
      setText(value);
      if (!openName) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void flush(openName, value);
      }, SAVE_DEBOUNCE_MS);
    },
    [openName, flush],
  );

  const create = useCallback(
    async (name: string) => {
      const res = await window.api.studioNoteWrite({ projectId, name, text: '' });
      if (res.success && res.note) {
        await reload();
        await open(res.note.name);
        return true;
      }
      setStatus('error');
      setError(res.error ?? 'Failed to create note');
      return false;
    },
    [projectId, reload, open],
  );

  const remove = useCallback(
    async (name: string) => {
      const res = await window.api.studioNoteDelete({ projectId, name });
      if (!res.success) {
        setStatus('error');
        setError(res.error ?? 'Failed to delete note');
        return;
      }
      if (openName === name) {
        setOpenName(null);
        setText('');
      }
      await reload();
    },
    [projectId, openName, reload],
  );

  // Flush a pending edit when the tab unmounts (the user switched tabs or
  // closed the project). Runs ONLY on unmount: a cleanup that re-ran on every
  // keystroke would cancel the debounce and write the previous render's text
  // (that is exactly the bug the live check caught on 2026-10-01), so the
  // latest values come from a ref instead of the closure.
  const latest = useRef({ projectId, openName, text });
  latest.current = { projectId, openName, text };
  useEffect(() => {
    return () => {
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const { projectId: pid, openName: name, text: value } = latest.current;
      if (name) void window.api.studioNoteWrite({ projectId: pid, name, text: value });
    };
  }, []);

  return { notes, openName, text, status, error, open, edit, create, remove, reload };
}
