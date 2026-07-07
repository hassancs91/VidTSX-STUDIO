import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import type { editor } from 'monaco-editor';

// Flag to track initialization
let isConfigured = false;

/**
 * Configure Monaco Editor for offline usage in Electron.
 * This must be called BEFORE any Monaco Editor components are rendered.
 *
 * By default, @monaco-editor/react loads Monaco from a CDN.
 * For Electron apps, we need to bundle Monaco locally.
 */
export function configureMonacoOffline(): void {
  if (isConfigured) return;

  // Configure worker environment for Vite bundling
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'typescript' || label === 'javascript') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      if (label === 'json') {
        return new Worker(
          new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
          { type: 'module' }
        );
      }
      return new Worker(
        new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
        { type: 'module' }
      );
    },
  };

  // Tell the loader to use our local monaco-editor instance
  loader.config({ monaco });

  isConfigured = true;
}

/**
 * Get Monaco editor options for TSX editing
 */
export function getEditorOptions(): editor.IStandaloneEditorConstructionOptions {
  return {
    language: 'typescript',
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: '"SF Mono", "Cascadia Code", "JetBrains Mono", "Fira Code", monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: 'on',
    bracketPairColorization: { enabled: true },
    padding: { top: 8, bottom: 8 },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    smoothScrolling: true,
  };
}
