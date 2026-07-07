import { createContext, useContext, useState, ReactNode } from 'react';
import type { FileNode } from '../types';

interface SelectedFileContextValue {
  selectedFile: FileNode | null;
  setSelectedFile: (file: FileNode | null) => void;
}

const SelectedFileContext = createContext<SelectedFileContextValue | null>(null);

interface SelectedFileProviderProps {
  children: ReactNode;
}

export function SelectedFileProvider({ children }: SelectedFileProviderProps) {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

  return (
    <SelectedFileContext.Provider value={{ selectedFile, setSelectedFile }}>
      {children}
    </SelectedFileContext.Provider>
  );
}

export function useSelectedFile(): SelectedFileContextValue {
  const context = useContext(SelectedFileContext);
  if (!context) {
    throw new Error('useSelectedFile must be used within SelectedFileProvider');
  }
  return context;
}
