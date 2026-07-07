export interface PrototyperChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  htmlCode?: string;
  timestamp: number;
}

export interface PrototyperProject {
  folderPath: string;
  name: string;
  versions: string[];
  currentVersion: string;
  currentHtml: string;
  chatHistory: PrototyperChatMessage[];
}

export interface PrototyperLibraryProject {
  folderPath: string;
  name: string;
  versions: string[];
  screenshots: string[];
  recordings: string[];
}

export interface PrototyperLibraryState {
  folders: { folderPath: string; name: string; projects: PrototyperLibraryProject[] }[];
  rootProjects: PrototyperLibraryProject[];
}
