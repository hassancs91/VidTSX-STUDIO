import { useRef, useEffect, useCallback } from 'react';
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { getEditorOptions } from '../services/monaco-config';
import type { CodeEditorProps } from '../types';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full bg-app-base">
      <div className="text-center">
        <div
          className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"
          role="status"
        />
        <p className="text-text-dim text-[11px]">Loading editor...</p>
      </div>
    </div>
  );
}

export function CodeEditor({
  filePath,
  content,
  onChange,
  onSave,
  className = '',
  language = 'typescript',
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const contentRef = useRef(content);

  // Keep content ref in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;

      // Configure TypeScript for React/JSX
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: monaco.languages.typescript.JsxEmit.React,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        allowNonTsExtensions: true,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        strict: true,
      });

      // Add Ctrl+S / Cmd+S save shortcut
      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          onSave();
        }
      );

      // Focus the editor
      editorInstance.focus();
    },
    [onSave]
  );

  // Handle content changes
  const handleChange: OnChange = useCallback(
    (value) => {
      onChange(value ?? '');
    },
    [onChange]
  );

  // Update editor content when file changes externally (new file selected)
  useEffect(() => {
    const editorInstance = editorRef.current;
    if (editorInstance && filePath) {
      const currentValue = editorInstance.getValue();
      // Only update if content actually changed (avoid cursor jump)
      if (currentValue !== content) {
        editorInstance.setValue(content);
      }
    }
  }, [filePath, content]);

  return (
    <div className={`flex flex-col bg-app-base ${className}`}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={content}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={getEditorOptions()}
        theme="vs-dark"
        loading={<LoadingSpinner />}
        path={filePath ?? 'untitled.tsx'}
      />
    </div>
  );
}
