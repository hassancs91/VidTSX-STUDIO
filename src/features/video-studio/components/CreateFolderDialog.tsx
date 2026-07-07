import { useState, useCallback } from 'react';

interface CreateFolderDialogProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function CreateFolderDialog({ onConfirm, onCancel }: CreateFolderDialogProps) {
  const [name, setName] = useState('');

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  }, [name, onConfirm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleSubmit, onCancel],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-app-surface border border-border rounded-lg p-4 w-[300px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[13px] font-medium text-text-primary mb-3">New Folder</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Folder name..."
          className="w-full h-[32px] px-2.5 rounded text-[12px] bg-app-base border border-border text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            className="h-[28px] px-3 rounded text-[11px] text-text-secondary hover:text-text-primary transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-[28px] px-3 rounded text-[11px] bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-40"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
