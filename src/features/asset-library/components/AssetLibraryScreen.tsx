import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAssetLibrary } from '../hooks/useAssetLibrary';
import { useAssetActions } from '../hooks/useAssetActions';
import { useAssetClipboard } from '../hooks/useAssetClipboard';
import { useLibraryIndex, toLibraryRelPath } from '../hooks/useLibraryIndex';
import { useBrands } from '../hooks/useBrands';
import { usePresets } from '../hooks/usePresets';
import { useLibraryDescribe } from '../hooks/useLibraryDescribe';
import { useLibraryOrganize } from '../hooks/useLibraryOrganize';
import { AssetToolbar } from './AssetToolbar';
import { BrandsDialog } from './BrandsDialog';
import { PresetsDialog } from './PresetsDialog';
import { AssetBreadcrumb } from './AssetBreadcrumb';
import { AssetGrid } from './AssetGrid';
import { AssetSearchBar } from './AssetSearchBar';
import { AssetDetailsPanel } from './AssetDetailsPanel';
import { DescribeNote } from './DescribeNote';
import { DescribeProgress } from './DescribeProgress';
import { DescribeConsentDialog } from './DescribeConsentDialog';
import { OrganizeDialog } from './OrganizeDialog';
import { describeTargets } from '../services/describe-targets';
import {
  filterAssets,
  flattenAssetFiles,
  formatBytes,
  type CategoryFilter,
} from '../services/asset-search';
import type { AssetEntry } from '../types';

export function AssetLibraryScreen() {
  const { rootPath, currentPath, entries, nodes, loading, error, navigate, refresh } =
    useAssetLibrary();
  const { metaByRelPath, sizes, refreshIndex, saveDescription, applyDescription } =
    useLibraryIndex();

  // Any disk change re-lists the folder AND re-scans the index overlay,
  // so rel-path keys (and sizes) stay in step with reality.
  const onChanged = useCallback(async () => {
    await refresh();
    await refreshIndex();
  }, [refresh, refreshIndex]);

  // AI descriptions fold straight into the index already in state — one
  // re-scan per batch instead of one per asset.
  const describe = useLibraryDescribe(applyDescription);
  const organize = useLibraryOrganize(() => void onChanged());
  const [pendingDescribe, setPendingDescribe] = useState<string[] | null>(null);

  const { importFiles, createFolder, renameNode, moveNode, deleteNode } = useAssetActions({
    currentPath,
    onChanged,
  });
  const { copyAssetUrl, copyRawPath } = useAssetClipboard();

  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [moduleServerUrl, setModuleServerUrl] = useState<string | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<AssetEntry | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [brandsOpen, setBrandsOpen] = useState(false);
  const brandsApi = useBrands();
  const [presetsOpen, setPresetsOpen] = useState(false);
  const presetsApi = usePresets();
  // Studio's Project settings "Create brand…" / "Create preset…" (video-10
  // feedback item 7) land here on the dialog's new-item form. The token
  // remounts the dialog so a request while it is already open still works.
  const [openRequest, setOpenRequest] = useState<{ form: 'brand' | 'preset'; token: number } | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      const form = (e as CustomEvent<{ form?: string }>).detail?.form;
      if (form !== 'brand' && form !== 'preset') return;
      setOpenRequest({ form, token: Date.now() });
      if (form === 'brand') setBrandsOpen(true);
      else setPresetsOpen(true);
    };
    window.addEventListener('vidtsx:assets-open', handler);
    return () => window.removeEventListener('vidtsx:assets-open', handler);
  }, []);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const metaFor = useCallback(
    (absPath: string) =>
      rootPath ? metaByRelPath.get(toLibraryRelPath(rootPath, absPath)) : undefined,
    [rootPath, metaByRelPath]
  );

  // Searching flattens the listed subtree — the breadcrumb is the scope,
  // so searching at the root searches the whole library.
  const searching = query.trim() !== '' || category !== 'all';
  const displayedEntries = useMemo(
    () =>
      searching
        ? filterAssets(flattenAssetFiles(nodes), query, category, (p) => metaFor(p)?.description)
        : entries,
    [searching, nodes, query, category, entries, metaFor]
  );

  const subtitleFor = useCallback(
    (entry: AssetEntry): string | undefined => {
      if (entry.node.type === 'folder') {
        const bytes = sizes?.folders[toLibraryRelPath(rootPath, entry.node.path)];
        return bytes !== undefined ? formatBytes(bytes) : undefined;
      }
      return metaFor(entry.node.path)?.description;
    },
    [sizes, rootPath, metaFor]
  );

  // Batch scope = what the breadcrumb is showing (the whole subtree), minus
  // assets that already have a description. Same rule the toolbar counts.
  const describeScope = useMemo(
    () =>
      flattenAssetFiles(nodes)
        .map((entry) => toLibraryRelPath(rootPath, entry.node.path))
        .filter((relPath) => relPath !== ''),
    [nodes, rootPath]
  );
  const describeTargetPaths = useMemo(
    () => describeTargets(describeScope, metaByRelPath),
    [describeScope, metaByRelPath]
  );

  /** Consent first, then the batch — main refuses it the other way round. */
  const runDescribe = useCallback(
    async (relPaths: string[]) => {
      if (relPaths.length === 0) return;
      if (!describe.prefs?.describeConsentAt) {
        setPendingDescribe(relPaths);
        return;
      }
      await describe.startBatch(relPaths);
    },
    [describe]
  );

  const confirmConsent = useCallback(async () => {
    const relPaths = pendingDescribe ?? [];
    setPendingDescribe(null);
    await describe.grantConsent();
    await describe.startBatch(relPaths);
  }, [pendingDescribe, describe]);

  /**
   * Auto-describe on import (L2): ON by default for LIBRARY imports — this
   * path only. Project footage comes in through the Studio media pool and
   * never reaches here. Silent when describing is unavailable or unconsented:
   * an import must never block or nag on a describe.
   */
  const handleImport = useCallback(async () => {
    const before = new Set(describeScope);
    await importFiles();
    const res = await window.api.libraryIndexGet();
    if (!res.success || !res.entries) return;
    if (!describe.availability?.available) return;
    if (!describe.prefs?.autoDescribeOnImport || !describe.prefs.describeConsentAt) return;

    const fresh = describeTargets(
      res.entries.map((e) => e.relPath).filter((relPath) => !before.has(relPath)),
      new Map(res.entries.map((e) => [e.relPath, e]))
    );
    if (fresh.length > 0) await describe.startBatch(fresh);
  }, [describeScope, importFiles, describe]);

  // Refresh re-probes the provider too: this screen stays mounted for the
  // app's lifetime, so it is the user's way to pick up a provider they just
  // configured in Settings without restarting.
  const handleRefresh = useCallback(async () => {
    await onChanged();
    await describe.refreshAvailability();
  }, [onChanged, describe]);

  const aiDisabledReason =
    describe.availability && !describe.availability.available
      ? `${describe.availability.message} Describe and Organize need one.`
      : undefined;
  const showNote =
    describe.availability !== null &&
    !describe.availability.available &&
    describe.prefs !== null &&
    !describe.prefs.noProviderNoteDismissed;

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
    const entry = displayedEntries.find((e) => e.node.path === path);
    if (entry?.node.type === 'folder') {
      navigate(entry.node.path);
    }
  };

  const selectedEntry =
    selectedPath !== null
      ? displayedEntries.find((e) => e.node.path === selectedPath && e.node.type === 'file')
      : undefined;
  const selectedPreviewUrl =
    selectedEntry && selectedEntry.category === 'image' && moduleServerUrl
      ? `${moduleServerUrl}/asset?path=${encodeURIComponent(selectedEntry.node.path)}`
      : null;
  const selectedGlbUrl =
    selectedEntry && selectedEntry.category === 'model3d' && selectedEntry.ext.toLowerCase() === '.glb' && moduleServerUrl
      ? `${moduleServerUrl}/asset?path=${encodeURIComponent(selectedEntry.node.path)}`
      : null;
  const currentFolderBytes = sizes?.folders[toLibraryRelPath(rootPath, currentPath)];

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
          onImport={() => void handleImport()}
          onCreateFolder={createFolder}
          onRefresh={() => void handleRefresh()}
          onBrands={() => setBrandsOpen(true)}
          onPresets={() => setPresetsOpen(true)}
          onDescribe={() => void runDescribe(describeTargetPaths)}
          onOrganize={() => void organize.suggest()}
          aiDisabledReason={aiDisabledReason}
          describeBusy={describe.batch.running}
          organizeBusy={organize.suggesting}
          describeCount={describeTargetPaths.length}
        />
        {showNote && describe.availability && !describe.availability.available && (
          <DescribeNote
            message={describe.availability.message}
            onDismiss={() => void describe.dismissNote()}
          />
        )}
        {(describe.batch.running || describe.batch.summary) && (
          <DescribeProgress
            running={describe.batch.running}
            done={describe.batch.done}
            total={describe.batch.total}
            summary={describe.batch.summary}
            onCancel={() => void describe.cancelBatch()}
          />
        )}
        {organize.error && !organize.plan && (
          <div className="text-[11px] text-red-400" data-organize-error>
            {organize.error}
          </div>
        )}
        <AssetSearchBar query={query} onQuery={setQuery} category={category} onCategory={setCategory} />
        <AssetBreadcrumb rootPath={rootPath} currentPath={currentPath} onNavigate={navigate} />
      </header>

      <div className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-auto">
          <AssetGrid
            entries={displayedEntries}
            loading={loading}
            error={error}
            selectedPath={selectedPath}
            moduleServerUrl={moduleServerUrl}
            subtitleFor={subtitleFor}
            onSelect={setSelectedPath}
            onOpen={handleOpen}
            onCopyUrl={copyAssetUrl}
            onCopyRawPath={copyRawPath}
            onRename={handleRename}
            onDelete={handleDelete}
            onMove={moveNode}
          />
        </div>
        {selectedEntry && (
          <AssetDetailsPanel
            entry={selectedEntry}
            meta={metaFor(selectedEntry.node.path)}
            previewUrl={selectedPreviewUrl}
            glbUrl={selectedGlbUrl}
            onSaveDescription={saveDescription}
            onClose={() => setSelectedPath(null)}
          />
        )}
      </div>

      <footer
        className="flex items-center justify-between px-4 py-1.5 text-[10px] text-text-dim"
        style={{ borderTop: '0.5px solid var(--color-border)' }}
      >
        <span>
          {displayedEntries.length} item{displayedEntries.length === 1 ? '' : 's'}
          {searching ? ' (filtered)' : ''}
          {!searching && currentFolderBytes !== undefined
            ? ` · ${formatBytes(currentFolderBytes)}`
            : ''}
        </span>
        {sizes && <span>Library total {formatBytes(sizes.total)}</span>}
      </footer>

      {brandsOpen && (
        <BrandsDialog
          key={openRequest?.form === 'brand' ? openRequest.token : 'brands'}
          startNew={openRequest?.form === 'brand'}
          brands={brandsApi.brands}
          defaultBrandId={brandsApi.defaultBrandId}
          onSave={brandsApi.saveBrand}
          onDelete={brandsApi.deleteBrand}
          onSetDefault={brandsApi.setDefault}
          onMutated={() => void onChanged()}
          onClose={() => {
            setBrandsOpen(false);
            setOpenRequest(null);
          }}
        />
      )}

      {presetsOpen && (
        <PresetsDialog
          key={openRequest?.form === 'preset' ? openRequest.token : 'presets'}
          startNew={openRequest?.form === 'preset'}
          presets={presetsApi.presets}
          brands={brandsApi.brands.map((b) => ({ id: b.id, name: b.name }))}
          onSave={presetsApi.savePreset}
          onDelete={presetsApi.deletePreset}
          onMutated={() => void onChanged()}
          onClose={() => {
            setPresetsOpen(false);
            setOpenRequest(null);
          }}
        />
      )}

      {pendingDescribe && describe.availability?.available && (
        <DescribeConsentDialog
          count={pendingDescribe.length}
          providerId={describe.availability.providerId}
          onAllow={() => void confirmConsent()}
          onCancel={() => setPendingDescribe(null)}
        />
      )}

      {organize.plan && (
        <OrganizeDialog
          plan={organize.plan}
          applying={organize.applying}
          error={organize.error}
          onToggle={organize.toggle}
          onSetAll={organize.setAllAccepted}
          onApply={() => void organize.apply()}
          onClose={organize.close}
        />
      )}

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
