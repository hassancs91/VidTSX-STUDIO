// Editor state
export interface EditorState {
  content: string;
  filePath: string | null;
  fileName: string;
  lineCount: number;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
}

// Editor mode toggle
export type EditorMode = 'code' | 'visual';

// CodeEditor component props
export interface CodeEditorProps {
  filePath: string | null;
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  className?: string;
  language?: string;
}

// EditorToolbar props
export interface EditorToolbarProps {
  fileName: string;
  lineCount: number;
  isSaving: boolean;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onRender: () => void;
}

// Resizable divider props
export interface ResizableDividerProps {
  onResize: (deltaY: number) => void;
  onResizeEnd: () => void;
}
