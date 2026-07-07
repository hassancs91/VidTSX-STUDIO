import { useEffect } from 'react';

interface DeleteImageDialogProps {
  promptText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteImageDialog({ promptText, onConfirm, onCancel }: DeleteImageDialogProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  const truncated = promptText.length > 80 ? promptText.slice(0, 80) + '...' : promptText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="bg-app-surface border border-border rounded-lg p-4 w-[340px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[13px] font-medium text-text-primary mb-2">
          Delete this image?
        </h3>
        <p className="text-[11px] text-text-secondary mb-1 line-clamp-2">
          {truncated}
        </p>
        <p className="text-[11px] text-text-dim mb-3">
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="h-[28px] px-3 rounded text-[11px] text-text-secondary hover:text-text-primary transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="h-[28px] px-3 rounded text-[11px] bg-red-600 text-white hover:bg-red-700 transition-colors"
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
