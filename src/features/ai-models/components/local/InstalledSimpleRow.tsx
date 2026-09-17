import { useState, type ReactNode } from 'react';
import { FamilyBadge } from '../FamilyBadge';

interface InstalledSimpleRowProps {
  id: string;
  name: string;
  family: string;
  sizeLabel: string;
  /** Extra chips after the family badge ("Default"). */
  badges?: ReactNode;
  onDelete: (id: string) => void;
}

/**
 * An installed row for categories with nothing to configure per model
 * (Audio's whisper sizes): name · family · size · Ready · Delete with an
 * inline confirm — the same shape as the image / video Installed rows.
 */
export function InstalledSimpleRow({ id, name, family, sizeLabel, badges, onDelete }: InstalledSimpleRowProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0" data-installed-row={id}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[12px] text-text-secondary">{name}</span>
          <FamilyBadge family={family} />
          {badges}
        </div>
        <div className="font-mono text-[9px] text-text-dim">{sizeLabel}</div>
      </div>
      <span className="whitespace-nowrap text-[10px] text-accent-green">Ready</span>
      {confirming ? (
        <button
          type="button"
          onClick={() => onDelete(id)}
          className="h-[22px] rounded px-1.5 text-[9px] font-medium text-accent-red hover:bg-accent-red/10"
          title="Deletes the file from disk"
        >
          Confirm delete
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          onBlur={() => setConfirming(false)}
          className="h-[22px] rounded px-1.5 text-[9px] text-text-dim hover:bg-app-hover hover:text-accent-red"
          title="Delete file from disk"
        >
          Delete
        </button>
      )}
    </div>
  );
}
