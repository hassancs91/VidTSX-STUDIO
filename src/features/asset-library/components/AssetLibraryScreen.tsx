import { useEffect, useState } from 'react';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { useAssetActions } from '../hooks/useAssetActions';
import { useAssetClipboard } from '../hooks/useAssetClipboard';
import { AssetToolbar } from './AssetToolbar';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { AssetGrid } from './AssetGrid';
import type { AssetEntry } from '../types';

export function AssetLibraryScreen() {
  const { rootPath, currentPath, entries, loading, error, navigate, refresh } = useAssetLibrary();
  const { importFiles, createFolder, renameNode, moveNode, deleteNode } = useAssetActions({
    currentPath,
    onChanged: refresh,
  });
  const { copyAssetUrl, copyRawPath } = useAssetClipboard();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [moduleServerUrl, setModuleServerUrl] = useState<string | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<AssetEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Fetch the module server URL once so image previews can load via /asset.
  // Falls back to null if unavailable — non-image tiles render type icons either way.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.api.moduleServerUrl();
        if (!cancelled) setModuleServerUrl(res.url ?? null);
      } catch {
        if (!cancelled) setModuleServerUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Clear selection when changing directory so stale paths don't show as selected.
  useEffect(() => {
    setSelectedPath(null);
  }, [currentPath]);

  const handleOpen = (path: string) => {
    const entry = entries.find((e) => e.node.path === path);
    if (entry?.node.type === 'folder') {
      navigate(entry.node.path);
    }
  };

  const handleDelete = (entry: AssetEntry) => {
    const isFolder = entry.node.type === 'folder';
    const ok = window.confirm(
      isFolder
        ? `Delete folder "${entry.node.name}" and everything inside?`
        : `Delete "${entry.node.name}"?`
    );
    if (!ok) return;
    void deleteNode(entry.node.path, isFolder);
  };

  const handleRename = (entry: AssetEntry) => {
    setRenamingEntry(entry);
    setRenameValue(entry.node.name);
  };

  const submitRename = async () => {
    const entry = renamingEntry;
    if (!entry) return;
    setRenamingEntry(null);
    if (renameValue.trim() && renameValue.trim() !== entry.node.name) {
      await renameNode(entry.node.path, renameValue.trim());
    }
    setRenameValue('');
  };

  return (
    <div className="flex flex-col h-full bg-app-base">
      <header
        className="flex flex-col gap-3 px-4 py-3"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <h1 className="text-[14px] font-medium text-text-primary">Assets</h1>
        <AssetToolbar
          onImport={importFiles}
          onCreateFolder={createFolder}
          onRefresh={() => void refresh()}
        />
        <AssetBreadcrumb rootPath={rootPath} currentPath={currentPath} onNavigate={navigate} />
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        <AssetGrid
          entries={entries}
          loading={loading}
          error={error}
          selectedPath={selectedPath}
          moduleServerUrl={moduleServerUrl}
          onSelect={setSelectedPath}
          onOpen={handleOpen}
          onCopyUrl={copyAssetUrl}
          onCopyRawPath={copyRawPath}
          onRename={handleRename}
          onDelete={handleDelete}
          onMove={moveNode}
        />
      </div>

      {renamingEntry && (
        <RenameDialog
          name={renameValue}
          onChange={setRenameValue}
          onSubmit={submitRename}
          onCancel={() => { setRenamingEntry(null); setRenameValue(''); }}
        />
      )}
    </div>
  );
}

function RenameDialog({
  name,
  onChange,
  onSubmit,
  onCancel,
}: {
  name: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[320px] p-4 rounded-md bg-app-surface flex flex-col gap-3"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="text-[12px] text-text-secondary">New name</div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') onCancel();
          }}
          className="h-[30px] px-2 rounded bg-app-base text-text-primary text-[12px] focus:outline-none"
          style={{ border: '0.5px solid var(--color-border-input)' }}
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[12px] text-text-secondary hover:bg-app-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-3 py-1.5 rounded bg-accent text-white text-[12px] font-medium hover:opacity-90"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
