import { useState } from 'react';
import type { PrototyperLibraryProject, PrototyperLibraryState } from '../types';
import { Modal } from '@shared/components/Modal';

interface PrototyperLibraryPanelProps {
  library: PrototyperLibraryState;
  activeProjectPath: string | null;
  activeVersionPath: string | null;
  onLoadVersion: (filePath: string, folderPath: string) => void;
  onRenameProject: (folderPath: string, newName: string) => void;
  onDeleteProject: (folderPath: string) => void;
}

export function PrototyperLibraryPanel({
  library,
  activeProjectPath,
  activeVersionPath,
  onLoadVersion,
  onRenameProject,
  onDeleteProject,
}: PrototyperLibraryPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingName, setEditingName] = useState<{ path: string; value: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleRenameSubmit = (folderPath: string) => {
    if (editingName && editingName.value.trim()) {
      onRenameProject(folderPath, editingName.value.trim());
    }
    setEditingName(null);
  };

  const renderProject = (proj: PrototyperLibraryProject) => {
    const isActive = activeProjectPath === proj.folderPath;
    const isExpanded = expanded.has(proj.folderPath);
    const isEditing = editingName?.path === proj.folderPath;

    return (
      <div key={proj.folderPath} className="mb-0.5">
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-[4px] cursor-pointer text-[12px] group ${
            isActive ? 'bg-app-active text-accent-light' : 'text-text-primary hover:bg-app-hover'
          }`}
          onClick={() => toggleExpand(proj.folderPath)}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            className={`shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          >
            <path d="M3 1L8 5L3 9V1Z" />
          </svg>

          {isEditing ? (
            <input
              autoFocus
              value={editingName.value}
              onChange={(e) => setEditingName({ ...editingName, value: e.target.value })}
              onBlur={() => handleRenameSubmit(proj.folderPath)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(proj.folderPath);
                if (e.key === 'Escape') setEditingName(null);
              }}
              className="flex-1 min-w-0 bg-transparent outline-none text-[12px]"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="flex-1 truncate"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingName({ path: proj.folderPath, value: proj.name });
              }}
            >
              {proj.name}
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteConfirm(proj.folderPath);
            }}
            className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-red-400 shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zM14 3a1 1 0 01-1 1H3a1 1 0 010-2h3.5l.5-1h2l.5 1H13a1 1 0 011 1zM4 5v8a2 2 0 002 2h4a2 2 0 002-2V5H4z" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="ml-4">
            {proj.versions.map((v) => {
              const fileName = v.split(/[/\\]/).pop() || v;
              const isActiveVersion = activeVersionPath === v;
              return (
                <div
                  key={v}
                  onClick={() => onLoadVersion(v, proj.folderPath)}
                  className={`px-2 py-0.5 rounded-[4px] cursor-pointer text-[11px] ${
                    isActiveVersion
                      ? 'text-accent-light bg-app-active'
                      : 'text-text-muted hover:bg-app-hover hover:text-text-primary'
                  }`}
                >
                  {fileName}
                </div>
              );
            })}
            {proj.screenshots.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-text-dim font-medium mt-1">
                  Screenshots
                </div>
                {proj.screenshots.map((s) => {
                  const fileName = s.split(/[/\\]/).pop() || s;
                  return (
                    <div
                      key={s}
                      onClick={() => window.api.renderOpenFile({ filePath: s })}
                      className="px-2 py-0.5 rounded-[4px] cursor-pointer text-[11px] text-text-muted hover:bg-app-hover hover:text-text-primary flex items-center gap-1 group"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <rect x="1" y="2" width="12" height="10" rx="1" />
                        <circle cx="4.5" cy="5.5" r="1" />
                        <path d="M13 9l-3-3-6 6" />
                      </svg>
                      <span className="flex-1 truncate">{fileName}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.api.renderOpenFolder({ filePath: s });
                        }}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-text-primary shrink-0"
                        title="Show in folder"
                      >
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 3.5A1.5 1.5 0 012.5 2h3l1.5 2h4.5A1.5 1.5 0 0113 5.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 10.5v-7z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            {proj.recordings.length > 0 && (
              <>
                <div className="px-2 py-1 text-[10px] text-text-dim font-medium mt-1">
                  Recordings
                </div>
                {proj.recordings.map((r) => {
                  const fileName = r.split(/[/\\]/).pop() || r;
                  return (
                    <div
                      key={r}
                      onClick={() => window.api.renderOpenFile({ filePath: r })}
                      className="px-2 py-0.5 rounded-[4px] cursor-pointer text-[11px] text-text-muted hover:bg-app-hover hover:text-text-primary flex items-center gap-1 group"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <polygon points="5,3 11,7 5,11" />
                      </svg>
                      <span className="flex-1 truncate">{fileName}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.api.renderOpenFolder({ filePath: r });
                        }}
                        className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-text-primary shrink-0"
                        title="Show in folder"
                      >
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 3.5A1.5 1.5 0 012.5 2h3l1.5 2h4.5A1.5 1.5 0 0113 5.5v5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 10.5v-7z" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-3 py-2 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[12px] font-medium text-text-primary">Library</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {library.rootProjects.length === 0 ? (
          <div className="text-[11px] text-text-dim text-center mt-4">No projects yet</div>
        ) : (
          library.rootProjects.map(renderProject)
        )}
      </div>

      <Modal
        isOpen={deleteConfirm !== null}
        title="Delete Project"
        onClose={() => setDeleteConfirm(null)}
      >
        <p className="text-[13px] text-text-primary mb-4">
          Are you sure you want to delete this project? This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteConfirm(null)}
            className="px-3 py-1.5 text-[12px] rounded-[6px] text-text-muted hover:bg-app-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (deleteConfirm) onDeleteProject(deleteConfirm);
              setDeleteConfirm(null);
            }}
            className="px-3 py-1.5 text-[12px] rounded-[6px] bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
