import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorState } from '../types';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('CodeEditor');

interface UseCodeEditorOptions {
  filePath: string | null;
  autoSaveDelay?: number;
  /** false = never write the file on edit; the buffer only persists through an
   *  explicit save action (append-only folders — Studio shot versions). */
  autoSave?: boolean;
  onAfterSave?: () => void;
}

interface UseCodeEditorResult {
  state: EditorState;
  content: string;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  reload: () => Promise<void>;
  /** Write any pending debounced auto-save immediately. */
  flushPendingSave: () => Promise<void>;
  /** Drop any pending debounced auto-save without writing. */
  cancelPendingSave: () => void;
}

const initialState: EditorState = {
  content: '',
  filePath: null,
  fileName: 'Untitled',
  lineCount: 0,
  isDirty: false,
  isSaving: false,
  lastSaved: null,
};

/**
 * Hook for managing code editor state with auto-save
 *
 * Features:
 * - Loads file content when filePath changes
 * - Auto-saves with configurable debounce (default 500ms)
 * - Tracks dirty state, line count, saving status
 */
export function useCodeEditor({
  filePath,
  autoSaveDelay = 500,
  autoSave = true,
  onAfterSave,
}: UseCodeEditorOptions): UseCodeEditorResult {
  const [state, setState] = useState<EditorState>(initialState);
  const [content, setContentInternal] = useState('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const filePathRef = useRef<string | null>(filePath);
  filePathRef.current = filePath;
  const onAfterSaveRef = useRef(onAfterSave);
  onAfterSaveRef.current = onAfterSave;

  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
  }, []);

  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current;
    cancelPendingSave();
    if (!pending) return;

    try {
      const result = await window.api.fileWrite({ path: pending.path, content: pending.content });
      // Only touch editor state if we're still on the file the write targeted.
      if (!result.error && filePathRef.current === pending.path) {
        lastSavedContentRef.current = pending.content;
        setState((prev) => ({ ...prev, isDirty: false, lastSaved: new Date() }));
      }
    } catch (err) {
      log.error('Flush save error', err);
    }
  }, [cancelPendingSave]);

  // Load file content when filePath changes
  useEffect(() => {
    // Flush any pending auto-save for the previous file so switching versions
    // never drops edits or misattributes them to the new file.
    void flushPendingSave();

    if (!filePath) {
      setState({
        ...initialState,
      });
      setContentInternal('');
      lastSavedContentRef.current = '';
      return;
    }

    const loadFile = async () => {
      try {
        const result = await window.api.fileRead({ path: filePath });
        if (result.error) {
          log.error('Failed to load file', result.error);
          return;
        }

        const fileContent = result.content;
        const fileName = filePath.split(/[\\/]/).pop() ?? 'Untitled';
        const lineCount = fileContent.split('\n').length;

        setContentInternal(fileContent);
        lastSavedContentRef.current = fileContent;

        setState({
          content: fileContent,
          filePath,
          fileName,
          lineCount,
          isDirty: false,
          isSaving: false,
          lastSaved: new Date(),
        });
      } catch (err) {
        log.error('Error loading file', err);
      }
    };

    loadFile();
  }, [filePath, flushPendingSave]);

  // Save function
  const save = useCallback(async () => {
    if (!state.filePath || !state.isDirty) return;

    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      const result = await window.api.fileWrite({
        path: state.filePath,
        content,
      });

      if (result.error) {
        log.error('Failed to save file', result.error);
        setState((prev) => ({ ...prev, isSaving: false }));
        return;
      }

      lastSavedContentRef.current = content;
      setState((prev) => ({
        ...prev,
        isDirty: false,
        isSaving: false,
        lastSaved: new Date(),
      }));
      onAfterSaveRef.current?.();
    } catch (err) {
      log.error('Error saving file', err);
      setState((prev) => ({ ...prev, isSaving: false }));
    }
  }, [content, state.filePath, state.isDirty]);

  // Content change handler with auto-save scheduling
  const setContent = useCallback(
    (newContent: string) => {
      setContentInternal(newContent);

      const lineCount = newContent.split('\n').length;
      const isDirty = newContent !== lastSavedContentRef.current;

      setState((prev) => ({
        ...prev,
        content: newContent,
        lineCount,
        isDirty,
      }));

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Schedule auto-save (capture the target path now — the file may change
      // before the debounce fires)
      if (autoSave && isDirty && state.filePath) {
        const targetPath = state.filePath;
        pendingSaveRef.current = { path: targetPath, content: newContent };
        saveTimeoutRef.current = setTimeout(() => {
          // A flush/cancel or a newer edit may have superseded this write
          if (pendingSaveRef.current?.path !== targetPath || pendingSaveRef.current.content !== newContent) {
            return;
          }
          pendingSaveRef.current = null;
          if (newContent !== lastSavedContentRef.current) {
            window.api
              .fileWrite({
                path: targetPath,
                content: newContent,
              })
              .then((result) => {
                // Only touch editor state if we're still on the file we wrote
                if (!result.error && filePathRef.current === targetPath) {
                  lastSavedContentRef.current = newContent;
                  setState((prev) => ({
                    ...prev,
                    isDirty: false,
                    isSaving: false,
                    lastSaved: new Date(),
                  }));
                  onAfterSaveRef.current?.();
                }
              })
              .catch((err) => {
                log.error('Auto-save error', err);
              });
          }
        }, autoSaveDelay);
      }
    },
    [autoSave, autoSaveDelay, state.filePath]
  );

  // Flush any pending auto-save on unmount so edits are never dropped
  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, [flushPendingSave]);

  // Reload file from disk
  const reload = useCallback(async () => {
    if (!state.filePath) return;

    try {
      const result = await window.api.fileRead({ path: state.filePath });
      if (!result.error) {
        setContentInternal(result.content);
        lastSavedContentRef.current = result.content;
        setState((prev) => ({
          ...prev,
          content: result.content,
          lineCount: result.content.split('\n').length,
          isDirty: false,
        }));
      }
    } catch (err) {
      log.error('Error reloading file', err);
    }
  }, [state.filePath]);

  return {
    state,
    content,
    setContent,
    save,
    reload,
    flushPendingSave,
    cancelPendingSave,
  };
}
