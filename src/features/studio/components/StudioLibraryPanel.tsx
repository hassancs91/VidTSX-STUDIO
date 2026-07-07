import { useMemo, useState } from 'react';
import type { LibraryFolder, LibraryProject, LibraryState } from '@shared/types/library';
import { useThumbnails } from '@shared/hooks/useThumbnails';
import { ChevronIcon, FolderIcon, ProjectIcon, TsxIcon, ImageIcon } from '@shared/components/library-icons';
import { VersionThumbnail } from '@shared/components/VersionThumbnail';

interface StudioLibraryPanelProps {
  library: LibraryState;
  selectedVersion: string | null;
  onPreviewVersion: (filePath: string) => void;
  onAddToTimeline: (filePath: string) => void;
  canAddToTimeline: boolean;
}

export function StudioLibraryPanel({ library, selectedVersion, onPreviewVersion, onAddToTimeline, canAddToTimeline }: StudioLibraryPanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { loadThumbnail, getThumbnail } = useThumbnails();

  const totalProjects =
    library.rootProjects.length +
    library.folders.reduce((sum, f) => sum + f.projects.length, 0);

  const filterProject = (p: LibraryProject): boolean => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    return p.versions.some((v) => {
      const name = v.split(/[/\\]/).pop() || '';
      return name.toLowerCase().includes(q);
    });
  };

  const folderNameMatches = (f: LibraryFolder): boolean => {
    if (!searchQuery) return false;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const filteredRootProjects = useMemo(
    () => library.rootProjects.filter(filterProject),
    [library.rootProjects, searchQuery]
  );

  const filteredFolders = useMemo(
    () =>
      library.folders
        .map((f) => {
          const projects = folderNameMatches(f) ? f.projects : f.projects.filter(filterProject);
          return { ...f, projects };
        })
        .filter((f) => {
          if (folderNameMatches(f)) return true;
          if (f.projects.length > 0) return true;
          return !searchQuery;
        }),
    [library.folders, searchQuery]
  );

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleProject = (path: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderVersions = (libProject: LibraryProject) => (
    <div style={{ borderTop: '0.5px solid var(--color-border)' }}>
      {libProject.versions.map((versionPath, index) => {
        const fileName = versionPath.split(/[/\\]/).pop() || versionPath;
        const isSelected = selectedVersion === versionPath;

        return (
          <div
            key={versionPath}
            className={`group/version flex items-center pl-6 pr-2 py-1 transition-colors cursor-pointer ${
              isSelected
                ? 'bg-app-active text-accent-light'
                : 'text-text-muted hover:bg-app-hover'
            }`}
            style={{
              borderBottom:
                index < libProject.versions.length - 1
                  ? '0.5px solid var(--color-border)'
                  : 'none',
            }}
            onClick={() => onPreviewVersion(versionPath)}
          >
            <span className="text-[12px] truncate flex-1 min-w-0 flex items-center gap-1">
              <span className="shrink-0 text-text-dim"><TsxIcon /></span>
              {fileName}
            </span>
            {canAddToTimeline && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToTimeline(versionPath);
                }}
                className="shrink-0 text-text-dim hover:text-accent transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ml-1 opacity-0 group-hover/version:opacity-100"
                title="Add to TSX track at playhead"
              >
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
                  <path d="M6 2V10M2 6H10" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderProject = (libProject: LibraryProject) => {
    const isExpanded = expandedProjects.has(libProject.folderPath);

    return (
      <div
        key={libProject.folderPath}
        className="bg-app-base rounded-[6px] overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div
          className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-app-hover text-text-secondary cursor-pointer"
          onClick={() => toggleProject(libProject.folderPath)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleProject(libProject.folderPath);
            }}
            className="shrink-0 cursor-pointer"
          >
            <ChevronIcon open={isExpanded} />
          </button>
          <span className="shrink-0">
            {showThumbnails && libProject.versions.length > 0 ? (
              <VersionThumbnail
                tsxFilePath={libProject.versions[libProject.versions.length - 1]}
                loadThumbnail={loadThumbnail}
                getThumbnail={getThumbnail}
              />
            ) : (
              <span className="text-text-dim"><ProjectIcon /></span>
            )}
          </span>
          <span className="text-[12px] font-medium truncate flex-1">{libProject.name}</span>
        </div>
        {isExpanded && renderVersions(libProject)}
      </div>
    );
  };

  const renderFolder = (folder: LibraryFolder) => {
    const isExpanded = expandedFolders.has(folder.folderPath);

    return (
      <div
        key={folder.folderPath}
        className="rounded-[6px] overflow-hidden bg-app-base"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div
          className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-app-hover text-text-secondary cursor-pointer"
          onClick={() => toggleFolder(folder.folderPath)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder.folderPath);
            }}
            className="shrink-0 cursor-pointer"
          >
            <ChevronIcon open={isExpanded} />
          </button>
          <span className="shrink-0 text-text-dim">
            <FolderIcon open={isExpanded} />
          </span>
          <span className="text-[12px] font-medium truncate flex-1">{folder.name}</span>
          {folder.projects.length > 0 && (
            <span className="text-[10px] text-text-dim shrink-0">{folder.projects.length}</span>
          )}
        </div>

        {isExpanded && (
          <div
            className="flex flex-col gap-1 px-1.5 pb-1.5"
            style={{ borderTop: '0.5px solid var(--color-border)' }}
          >
            {folder.projects.length === 0 ? (
              <span className="text-[11px] text-text-dim text-center py-2">Empty folder</span>
            ) : (
              folder.projects.map((p) => renderProject(p))
            )}
          </div>
        )}
      </div>
    );
  };

  const isEmpty = totalProjects === 0 && library.folders.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search + thumbnail toggle + count */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 min-w-0 bg-app-base text-[12px] text-text-primary placeholder:text-text-dim px-2 py-1 rounded-[4px] border-none outline-none focus:ring-1 focus:ring-accent"
        />
        {totalProjects > 0 && (
          <span className="text-[11px] text-text-dim shrink-0">({totalProjects})</span>
        )}
        <button
          onClick={() => setShowThumbnails((v) => !v)}
          className={`shrink-0 transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ${
            showThumbnails ? 'text-accent' : 'text-text-dim hover:text-text-primary'
          }`}
          title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}
        >
          <ImageIcon />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {isEmpty ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-[13px] text-text-dim text-center px-2">No projects yet</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredRootProjects.map((p) => renderProject(p))}

            {filteredRootProjects.length > 0 && filteredFolders.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                <span className="text-[10px] text-text-dim uppercase tracking-wider">Folders</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {filteredFolders.map((folder) => renderFolder(folder))}
          </div>
        )}
      </div>
    </div>
  );
}
