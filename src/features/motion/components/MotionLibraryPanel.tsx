import { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Button } from '@shared/components';
import { useRenderQueue, useRenderHistory } from '@features/render-queue';
import type { MotionProject, LibraryProject, LibraryState, LibraryFolder } from '../types';
import type { TsxJobIpc } from '../../../shared/ipc/types';
import { InlineRenameInput } from './InlineRenameInput';
import { VersionThumbnail } from '@shared/components/VersionThumbnail';
import { MoveToFolderMenu } from './MoveToFolderMenu';
import { useThumbnails } from '@shared/hooks/useThumbnails';
import { ChevronIcon, TrashIcon, FolderIcon, ImportIcon, FilePlusIcon, ProjectIcon, TsxIcon, ImageIcon } from '@shared/components/library-icons';
import { StudioShotsSection } from './StudioShotsSection';

interface MotionLibraryPanelProps {
  library: LibraryState;
  project: MotionProject | null;
  /** In-flight generate jobs shown as placeholder rows until their folder exists. */
  pendingJobs?: TsxJobIpc[];
  onLoadVersion: (filePath: string, folderPath: string) => void;
  onRenameProject: (folderPath: string, newName: string) => void;
  onRenameVersion: (filePath: string, newName: string) => void;
  onDeleteProject: (folderPath: string) => void;
  onDeleteVersion: (filePath: string, projectFolderPath: string) => void;
  onCreateFolder: (name: string) => void;
  onRenameFolder: (folderPath: string, newName: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onMoveProject: (projectPath: string, targetFolderPath: string) => void;
  onMoveProjectToRoot: (projectPath: string) => void;
  onImportProject: (parentFolder?: string) => void;
  onCreateEmpty: (parentFolder?: string) => void;
  onCollapse?: () => void;
}

export function MotionLibraryPanel({
  library,
  project,
  pendingJobs = [],
  onLoadVersion,
  onRenameProject,
  onRenameVersion,
  onDeleteProject,
  onDeleteVersion,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveProject,
  onMoveProjectToRoot,
  onImportProject,
  onCreateEmpty,
  onCollapse,
}: MotionLibraryPanelProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [renamingProject, setRenamingProject] = useState<string | null>(null);
  const [renamingVersion, setRenamingVersion] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ path: string; name: string; type: 'project' | 'folder' | 'version'; projectPath?: string } | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [draggingProject, setDraggingProject] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenderedOnly, setShowRenderedOnly] = useState(false);
  const [showFoldersOnly, setShowFoldersOnly] = useState(false);
  const [moveMenu, setMoveMenu] = useState<
    { x: number; y: number; projectPath: string; parentPath: string | null } | null
  >(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef(0);

  const { jobs } = useRenderQueue();
  const { renderedPaths } = useRenderHistory();
  const { loadThumbnail, getThumbnail } = useThumbnails();

  const renderingPaths = useMemo(() => {
    const set = new Set<string>();
    for (const job of jobs) {
      if (job.status === 'rendering' || job.status === 'queued') {
        set.add(job.filePath.replace(/\\/g, '/').toLowerCase());
      }
    }
    return set;
  }, [jobs]);

  const totalProjects = library.rootProjects.length +
    library.folders.reduce((sum, f) => sum + f.projects.length, 0);

  const filterProject = (p: LibraryProject): boolean => {
    if (showRenderedOnly) {
      const hasRendered = p.versions.some(
        (v) => renderedPaths.has(v.replace(/\\/g, '/').toLowerCase())
      );
      if (!hasRendered) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (p.name.toLowerCase().includes(q)) return true;
    return p.versions.some((v) => {
      const name = v.split(/[/\\]/).pop() || '';
      return name.toLowerCase().includes(q);
    });
  };

  const passesRenderedFilter = (p: LibraryProject): boolean => {
    if (!showRenderedOnly) return true;
    return p.versions.some(
      (v) => renderedPaths.has(v.replace(/\\/g, '/').toLowerCase())
    );
  };

  const folderNameMatches = (f: LibraryFolder): boolean => {
    if (!searchQuery) return false;
    return f.name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const filteredRootProjects = showFoldersOnly
    ? []
    : library.rootProjects.filter(filterProject);
  const filteredFolders = library.folders
    .map((f) => {
      // If folder name matches search, keep all its projects (rendered-filter only).
      // Otherwise filter projects by search + rendered.
      const projects = folderNameMatches(f)
        ? f.projects.filter(passesRenderedFilter)
        : f.projects.filter(filterProject);
      return { ...f, projects };
    })
    .filter((f) => {
      if (folderNameMatches(f)) return true;
      if (f.projects.length > 0) return true;
      return !searchQuery && !showRenderedOnly;
    });

  useEffect(() => {
    if (project?.folderPath) {
      setExpandedProjects((prev) => {
        const next = new Set(Array.from(prev));
        next.add(project.folderPath);
        return next;
      });
    }
  }, [project?.folderPath]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        setSelectedFolder((cur) => cur === path ? null : cur);
      } else {
        next.add(path);
        setSelectedFolder(path);
      }
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

  const getParentPath = (projectPath: string): string => {
    const normalized = projectPath.replace(/\\/g, '/');
    const parts = normalized.split('/');
    parts.pop();
    return parts.join('/');
  };

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, projectPath: string) => {
    e.dataTransfer.setData('text/plain', projectPath);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingProject(projectPath);
  };

  const handleDragOver = (e: React.DragEvent, targetPath: string) => {
    if (!draggingProject) return;
    const parentOfDragged = getParentPath(draggingProject);
    const normalizedTarget = targetPath.replace(/\\/g, '/');
    if (parentOfDragged === normalizedTarget) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetPath);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) return;
    setDragOverTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string, isRoot: boolean) => {
    e.preventDefault();
    const sourcePath = e.dataTransfer.getData('text/plain');
    if (!sourcePath) return;

    if (isRoot) {
      onMoveProjectToRoot(sourcePath);
    } else {
      onMoveProject(sourcePath, targetPath);
    }
    setDragOverTarget(null);
    setDraggingProject(null);
  };

  const handleDragEnd = () => {
    setDragOverTarget(null);
    setDraggingProject(null);
    stopAutoScroll();
  };

  // Edge-auto-scroll during drag
  const EDGE_PX = 48;
  const MAX_SCROLL_PX_PER_FRAME = 12;

  const runAutoScrollFrame = () => {
    const el = scrollContainerRef.current;
    const speed = scrollSpeedRef.current;
    if (!el || speed === 0) {
      rafIdRef.current = null;
      return;
    }
    el.scrollTop += speed;
    rafIdRef.current = requestAnimationFrame(runAutoScrollFrame);
  };

  const stopAutoScroll = () => {
    scrollSpeedRef.current = 0;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const updateAutoScroll = (clientY: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const distFromTop = clientY - rect.top;
    const distFromBottom = rect.bottom - clientY;

    let speed = 0;
    if (distFromTop >= 0 && distFromTop < EDGE_PX) {
      speed = -Math.round(MAX_SCROLL_PX_PER_FRAME * (1 - distFromTop / EDGE_PX));
    } else if (distFromBottom >= 0 && distFromBottom < EDGE_PX) {
      speed = Math.round(MAX_SCROLL_PX_PER_FRAME * (1 - distFromBottom / EDGE_PX));
    }

    scrollSpeedRef.current = speed;
    if (speed !== 0 && rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(runAutoScrollFrame);
    }
  };

  useEffect(() => {
    return () => stopAutoScroll();
  }, []);

  // Resolve the current parent folder of a project (null if at root)
  const findProjectParent = (projectPath: string): string | null => {
    for (const folder of library.folders) {
      if (folder.projects.some((p) => p.folderPath === projectPath)) {
        return folder.folderPath;
      }
    }
    return null;
  };

  const handleProjectContextMenu = (e: React.MouseEvent, projectPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setMoveMenu({
      x: e.clientX,
      y: e.clientY,
      projectPath,
      parentPath: findProjectParent(projectPath),
    });
  };

  const handleMoveMenuPick = (targetFolderPath: string | null) => {
    if (!moveMenu) return;
    if (targetFolderPath === null) {
      onMoveProjectToRoot(moveMenu.projectPath);
    } else {
      onMoveProject(moveMenu.projectPath, targetFolderPath);
    }
    setMoveMenu(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'project') {
      onDeleteProject(deleteTarget.path);
    } else if (deleteTarget.type === 'folder') {
      onDeleteFolder(deleteTarget.path);
    } else if (deleteTarget.type === 'version' && deleteTarget.projectPath) {
      onDeleteVersion(deleteTarget.path, deleteTarget.projectPath);
    }
    setDeleteTarget(null);
  };

  const renderVersions = (libProject: LibraryProject) => (
    <div style={{ borderTop: '0.5px solid var(--color-border)' }}>
      {libProject.versions.map((versionPath, index) => {
        const fileName = versionPath.split(/[/\\]/).pop() || versionPath;
        const isActiveVersion = project?.currentVersion === versionPath;
        const normalizedPath = versionPath.replace(/\\/g, '/').toLowerCase();
        const isRendered = renderedPaths.has(normalizedPath);
        const isRendering = renderingPaths.has(normalizedPath);
        const isRenamingThis = renamingVersion === versionPath;

        return (
          <div
            key={versionPath}
            className={`group/version flex items-center justify-between pl-6 pr-2 py-1 transition-colors cursor-pointer ${
              isActiveVersion
                ? 'bg-app-active text-accent-light'
                : isRendered
                  ? 'text-text-muted hover:brightness-125'
                  : 'text-text-muted hover:bg-app-hover'
            }`}
            style={{
              borderBottom: index < libProject.versions.length - 1
                ? '0.5px solid var(--color-border)' : 'none',
              ...(!isActiveVersion && isRendered ? { backgroundColor: 'rgba(34, 197, 94, 0.1)' } : {}),
            }}
            onClick={() => onLoadVersion(versionPath, libProject.folderPath)}
          >
            {isRenamingThis ? (
              <div onClick={(e) => e.stopPropagation()} className="flex-1 min-w-0">
                <InlineRenameInput
                  initialValue={fileName.replace(/\.tsx$/, '')}
                  onConfirm={(newName) => {
                    const finalName = newName.endsWith('.tsx') ? newName : `${newName}.tsx`;
                    onRenameVersion(versionPath, finalName);
                    setRenamingVersion(null);
                  }}
                  onCancel={() => setRenamingVersion(null)}
                />
              </div>
            ) : (
              <span
                className="text-[12px] truncate flex-1 min-w-0 flex items-center gap-1"
                onDoubleClick={(e) => { e.stopPropagation(); setRenamingVersion(versionPath); }}
              >
                <span className="shrink-0 text-text-dim"><TsxIcon /></span>
                {isRendering ? (
                  <span className="shrink-0 w-[10px] h-[10px] border-[1.5px] border-accent border-t-transparent rounded-full animate-spin" />
                ) : isRendered ? (
                  <span className="shrink-0 w-[5px] h-[5px] rounded-full bg-accent-green" />
                ) : null}
                {fileName}
              </span>
            )}
            {isActiveVersion && !isRenamingThis && (
              <span className="text-[8px] px-[3px] py-[0.5px] rounded-[3px] bg-accent text-white shrink-0 ml-1">
                active
              </span>
            )}
            {!isRenamingThis && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget({ path: versionPath, name: fileName, type: 'version', projectPath: libProject.folderPath });
                }}
                className="shrink-0 text-text-dim hover:text-accent-red transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ml-1 opacity-0 group-hover/version:opacity-100"
                title="Delete version"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderProject = (libProject: LibraryProject, indent: number) => {
    const isExpanded = expandedProjects.has(libProject.folderPath);
    const isActiveProject = project?.folderPath === libProject.folderPath;
    const isRenaming = renamingProject === libProject.folderPath;
    const hasRenderedVersion = libProject.versions.some(
      (v) => renderedPaths.has(v.replace(/\\/g, '/').toLowerCase())
    );

    return (
      <div
        key={libProject.folderPath}
        className="bg-app-base rounded-[6px] overflow-hidden"
        style={{ border: '0.5px solid var(--color-border)', marginLeft: indent }}
        draggable
        onDragStart={(e) => handleDragStart(e, libProject.folderPath)}
        onDragEnd={handleDragEnd}
        onContextMenu={(e) => handleProjectContextMenu(e, libProject.folderPath)}
      >
        <div
          className={`flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-app-hover ${
            isActiveProject ? 'text-accent-light' : 'text-text-secondary'
          }`}
        >
          <button onClick={() => toggleProject(libProject.folderPath)} className="shrink-0 cursor-pointer">
            <ChevronIcon open={isExpanded} />
          </button>
          <span
            className="shrink-0 cursor-pointer"
            onClick={() => {
              if (libProject.versions.length > 0) {
                onLoadVersion(libProject.versions[0], libProject.folderPath);
              }
              toggleProject(libProject.folderPath);
            }}
          >
            {showThumbnails && libProject.versions.length > 0 ? (
              <VersionThumbnail
                tsxFilePath={libProject.versions[libProject.versions.length - 1]}
                loadThumbnail={loadThumbnail}
                getThumbnail={getThumbnail}
              />
            ) : (
              <span className="text-text-dim">
                <ProjectIcon />
              </span>
            )}
          </span>
          {isRenaming ? (
            <InlineRenameInput
              initialValue={libProject.name}
              onConfirm={(newName) => { onRenameProject(libProject.folderPath, newName); setRenamingProject(null); }}
              onCancel={() => setRenamingProject(null)}
            />
          ) : (
            <span
              className="text-[12px] font-medium truncate flex-1 cursor-pointer"
              onClick={() => {
                if (libProject.versions.length > 0) {
                  onLoadVersion(libProject.versions[0], libProject.folderPath);
                }
                toggleProject(libProject.folderPath);
              }}
              onDoubleClick={(e) => { e.stopPropagation(); setRenamingProject(libProject.folderPath); }}
            >
              {libProject.name}
            </span>
          )}
          {isActiveProject && (
            <span className={`shrink-0 w-[6px] h-[6px] rounded-[2px] ${hasRenderedVersion ? 'bg-accent-green' : 'bg-yellow-500'}`} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ path: libProject.folderPath, name: libProject.name, type: 'project' }); }}
            className="shrink-0 text-text-dim hover:text-accent-red transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover"
            title="Delete project"
          >
            <TrashIcon />
          </button>
        </div>
        {isExpanded && renderVersions(libProject)}
      </div>
    );
  };

  const renderFolder = (folder: LibraryFolder) => {
    const isExpanded = expandedFolders.has(folder.folderPath);
    const isRenaming = renamingFolder === folder.folderPath;
    const isDragOver = dragOverTarget === folder.folderPath;

    return (
      <div
        key={folder.folderPath}
        className={`rounded-[6px] overflow-hidden transition-colors ${isDragOver ? 'bg-accent/10' : 'bg-app-base'}`}
        style={{ border: isDragOver ? '0.5px solid var(--color-accent)' : '0.5px solid var(--color-border)' }}
        onDragOver={(e) => handleDragOver(e, folder.folderPath)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folder.folderPath, false)}
      >
        {/* Folder header */}
        <div className="flex items-center gap-1 px-2 py-1.5 transition-colors hover:bg-app-hover text-text-secondary">
          <button onClick={() => toggleFolder(folder.folderPath)} className="shrink-0 cursor-pointer">
            <ChevronIcon open={isExpanded} />
          </button>
          <span className="shrink-0 text-text-dim">
            <FolderIcon open={isExpanded} />
          </span>
          {isRenaming ? (
            <InlineRenameInput
              initialValue={folder.name}
              onConfirm={(newName) => { onRenameFolder(folder.folderPath, newName); setRenamingFolder(null); }}
              onCancel={() => setRenamingFolder(null)}
            />
          ) : (
            <span
              className="text-[12px] font-medium truncate flex-1 cursor-pointer"
              onClick={() => toggleFolder(folder.folderPath)}
              onDoubleClick={(e) => { e.stopPropagation(); setRenamingFolder(folder.folderPath); }}
            >
              {folder.name}
            </span>
          )}
          {folder.projects.length > 0 && (
            <span className="text-[10px] text-text-dim shrink-0">{folder.projects.length}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ path: folder.folderPath, name: folder.name, type: 'folder' }); }}
            className="shrink-0 text-text-dim hover:text-accent-red transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover"
            title="Delete folder"
          >
            <TrashIcon />
          </button>
        </div>

        {/* Folder contents */}
        {isExpanded && (
          <div className="flex flex-col gap-1 px-1.5 pb-1.5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            {folder.projects.length === 0 ? (
              <span className="text-[11px] text-text-dim text-center py-2">Drop projects here</span>
            ) : (
              folder.projects.map((p) => renderProject(p, 0))
            )}
          </div>
        )}
      </div>
    );
  };

  const isEmpty = totalProjects === 0 && library.folders.length === 0 && pendingJobs.length === 0;

  return (
    <div
      className="flex flex-col shrink-0 bg-app-surface overflow-hidden h-full"
    >
      {/* Header */}
      <div
        className="flex items-center h-[36px] px-3 shrink-0 gap-1"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[13px] font-medium text-text-muted flex-1">Library</span>
        {totalProjects > 0 && (
          <span className="text-[11px] text-text-dim">({totalProjects})</span>
        )}
        <button
          onClick={() => setShowThumbnails((v) => !v)}
          className={`shrink-0 transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ${showThumbnails ? 'text-accent' : 'text-text-dim hover:text-text-primary'}`}
          title={showThumbnails ? 'Hide thumbnails' : 'Show thumbnails'}
        >
          <ImageIcon />
        </button>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="shrink-0 text-text-dim hover:text-text-primary transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover"
            title="Collapse library"
          >
            <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 2L6.5 5L3.5 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Action buttons */}
      <div
        className="flex flex-wrap gap-1 px-2 py-1.5 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <button
          onClick={() => onCreateEmpty(selectedFolder ?? undefined)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-[12px] text-text-secondary hover:text-text-primary bg-app-base hover:bg-app-hover transition-colors cursor-pointer"
        >
          <FilePlusIcon /> New
        </button>
        <button
          onClick={() => onImportProject(selectedFolder ?? undefined)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-[12px] text-text-secondary hover:text-text-primary bg-app-base hover:bg-app-hover transition-colors cursor-pointer"
        >
          <ImportIcon /> Import
        </button>
        <button
          onClick={() => setCreatingFolder(true)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] text-[12px] text-text-secondary hover:text-text-primary bg-app-base hover:bg-app-hover transition-colors cursor-pointer"
        >
          <FolderIcon open={false} /> Folder
        </button>
      </div>

      {/* Search */}
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
        <button
          onClick={() => setShowRenderedOnly((v) => !v)}
          className={`shrink-0 transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ${showRenderedOnly ? 'text-accent-green' : 'text-text-dim hover:text-text-primary'}`}
          title={showRenderedOnly ? 'Show all projects' : 'Show rendered only'}
        >
          <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth={1.3} fill={showRenderedOnly ? 'currentColor' : 'none'} />
          </svg>
        </button>
        <button
          onClick={() => setShowFoldersOnly((v) => !v)}
          className={`shrink-0 transition-colors cursor-pointer p-0.5 rounded hover:bg-app-hover ${showFoldersOnly ? 'text-accent' : 'text-text-dim hover:text-text-primary'}`}
          title={showFoldersOnly ? 'Show all projects' : 'Show folders only'}
        >
          <FolderIcon open={false} />
        </button>
      </div>

      {/* Content */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-2"
        onDragOver={(e) => {
          if (draggingProject) {
            handleDragOver(e, '__root__');
            updateAutoScroll(e.clientY);
          }
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          stopAutoScroll();
          if (draggingProject) handleDrop(e, '__root__', true);
        }}
      >
        {isEmpty && !creatingFolder ? (
          <div className="flex flex-col gap-1 h-full">
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[13px] text-text-dim text-center px-2">No projects yet</span>
            </div>
            <StudioShotsSection
              onLoadVersion={onLoadVersion}
              activeFolderPath={project?.folderPath}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {/* New folder input */}
            {creatingFolder && (
              <div
                className="bg-app-base rounded-[6px] px-2 py-1.5"
                style={{ border: '0.5px solid var(--color-accent)' }}
              >
                <InlineRenameInput
                  initialValue="New Folder"
                  onConfirm={(name) => { onCreateFolder(name); setCreatingFolder(false); }}
                  onCancel={() => setCreatingFolder(false)}
                />
              </div>
            )}

            {/* In-flight generations — visible before their project folder exists */}
            {pendingJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-[6px] px-2 py-1.5 flex items-center gap-2"
                style={{ border: '0.5px dashed var(--color-border)' }}
              >
                <div
                  className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0"
                  role="status"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] text-text-secondary truncate" title={job.prompt}>
                    {job.projectName ?? job.prompt}
                  </span>
                  <span className="text-[9px] text-text-dim">
                    {job.status === 'queued'
                      ? 'Queued'
                      : `${job.progress.label} ${job.progress.percent}%`}
                  </span>
                </div>
              </div>
            ))}

            {/* Root-level projects (newest first) */}
            {filteredRootProjects.map((p) => renderProject(p, 0))}

            {/* Folders divider — only when both sections have items */}
            {filteredRootProjects.length > 0 && filteredFolders.length > 0 && (
              <div className="flex items-center gap-2 px-1 pt-2 pb-0.5">
                <span className="text-[10px] text-text-dim uppercase tracking-wider">Folders</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {/* Folders */}
            {filteredFolders.map((folder) => renderFolder(folder))}

            {/* Studio projects' shot folders — a live view (SHOT_QUALITY Q2) */}
            <StudioShotsSection
              onLoadVersion={onLoadVersion}
              activeFolderPath={project?.folderPath}
            />

            {/* Root drop zone (visible during drag) */}
            {draggingProject && (
              <div
                className={`rounded-[6px] py-2 text-center text-[11px] transition-colors ${
                  dragOverTarget === '__root__'
                    ? 'bg-accent/10 text-accent-light border-accent'
                    : 'text-text-dim'
                }`}
                style={{
                  border: dragOverTarget === '__root__'
                    ? '1px dashed var(--color-accent)'
                    : '1px dashed var(--color-border)',
                }}
                onDragOver={(e) => handleDragOver(e, '__root__')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, '__root__', true)}
              >
                Move outside folder
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget?.type === 'folder' ? 'Delete Folder' : deleteTarget?.type === 'version' ? 'Delete Version' : 'Delete Project'}
      >
        <p className="text-[14px] text-text-secondary mb-4">
          {deleteTarget?.type === 'folder' ? (
            <>Delete folder <strong>{deleteTarget?.name}</strong> and all projects inside it? This cannot be undone.</>
          ) : deleteTarget?.type === 'version' ? (
            <>Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.</>
          ) : (
            <>Delete <strong>{deleteTarget?.name}</strong> and all its versions? This cannot be undone.</>
          )}
        </p>
        <div className="flex items-center gap-2 justify-end">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirmDelete} className="!bg-accent-red hover:!opacity-90">
            Delete
          </Button>
        </div>
      </Modal>

      {/* Move-to-folder context menu */}
      {moveMenu && (
        <MoveToFolderMenu
          x={moveMenu.x}
          y={moveMenu.y}
          folders={library.folders}
          currentParentPath={moveMenu.parentPath}
          onPick={handleMoveMenuPick}
          onClose={() => setMoveMenu(null)}
        />
      )}
    </div>
  );
}
