import { useState } from 'react';
import { ImportIcon, FolderIcon } from '@shared/components/library-icons';

interface AssetToolbarProps {
  onImport: () => void;
  onCreateFolder: (name: string) => void;
  onRefresh: () => void;
  onBrands: () => void;
  /** AI curation (L2/L7) — both disabled together when no provider exists. */
  onDescribe: () => void;
  onOrganize: () => void;
  /** Why the AI actions are unavailable; also their tooltip. */
  aiDisabledReason?: string;
  describeBusy: boolean;
  organizeBusy: boolean;
  /** How many assets "Describe with AI" would cover right now. */
  describeCount: number;
}

export function AssetToolbar({
  onImport,
  onCreateFolder,
  onRefresh,
  onBrands,
  onDescribe,
  onOrganize,
  aiDisabledReason,
  describeBusy,
  organizeBusy,
  describeCount,
}: AssetToolbarProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const submitFolder = () => {
    const name = folderName.trim();
    if (name) onCreateFolder(name);
    setFolderName('');
    setCreatingFolder(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onImport}
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded
          bg-accent text-white text-[12px] font-medium
          hover:opacity-90 transition-opacity
        "
      >
        <ImportIcon /> Import
      </button>

      {creatingFolder ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFolder();
              if (e.key === 'Escape') { setCreatingFolder(false); setFolderName(''); }
            }}
            onBlur={submitFolder}
            placeholder="Folder name"
            className="h-[28px] px-2 rounded bg-app-surface text-text-primary text-[12px] focus:outline-none"
            style={{ border: '0.5px solid var(--color-border-input)' }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreatingFolder(true)}
          className="
            flex items-center gap-1.5 px-3 py-1.5 rounded
            bg-app-surface text-text-secondary text-[12px]
            hover:bg-app-hover transition-colors
          "
        >
          <FolderIcon open={false} /> New Folder
        </button>
      )}

      <button
        type="button"
        onClick={onBrands}
        data-brands-button
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded
          bg-app-surface text-text-secondary text-[12px]
          hover:bg-app-hover transition-colors
        "
        title="Brand palettes, fonts, and style notes injected into generated shots"
      >
        Brands
      </button>

      {/* AI curation. Unavailable is a state, not an error (L2 Rev 3) — the
          buttons stay visible and explain themselves in the tooltip. */}
      <button
        type="button"
        onClick={onDescribe}
        disabled={Boolean(aiDisabledReason) || describeBusy || describeCount === 0}
        data-describe-button
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded
          bg-app-surface text-text-secondary text-[12px]
          hover:bg-app-hover transition-colors
          disabled:opacity-40 disabled:hover:bg-app-surface disabled:cursor-not-allowed
        "
        title={
          aiDisabledReason ??
          (describeCount === 0
            ? 'Every image here already has a description'
            : `Draft descriptions for ${describeCount} image${describeCount === 1 ? '' : 's'} with no description yet`)
        }
      >
        {describeBusy ? 'Describing…' : 'Describe with AI'}
      </button>

      <button
        type="button"
        onClick={onOrganize}
        disabled={Boolean(aiDisabledReason) || organizeBusy}
        data-organize-button
        className="
          flex items-center gap-1.5 px-3 py-1.5 rounded
          bg-app-surface text-text-secondary text-[12px]
          hover:bg-app-hover transition-colors
          disabled:opacity-40 disabled:hover:bg-app-surface disabled:cursor-not-allowed
        "
        title={aiDisabledReason ?? 'Propose a tidier folder layout — you review every move'}
      >
        {organizeBusy ? 'Thinking…' : 'Organize'}
      </button>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onRefresh}
        className="
          px-3 py-1.5 rounded text-[12px]
          text-text-muted hover:text-text-primary hover:bg-app-hover
        "
        title="Refresh"
      >
        Refresh
      </button>
    </div>
  );
}
