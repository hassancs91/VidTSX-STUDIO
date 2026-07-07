export interface LibraryProject {
  folderPath: string;
  name: string;
  versions: string[];
  mtimeMs: number;
}

export interface LibraryFolder {
  folderPath: string;
  name: string;
  projects: LibraryProject[];
  mtimeMs: number;
}

export interface LibraryState {
  folders: LibraryFolder[];
  rootProjects: LibraryProject[];
}
