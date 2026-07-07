interface DeleteFolderDialogProps {
  folderName: string;
  imageCount: number;
  onConfirm: (deleteImages: boolean) => void;
  onCancel: () => void;
}

export function DeleteFolderDialog({ folderName, imageCount, onConfirm, onCancel }: DeleteFolderDialogProps) {
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
          Delete &ldquo;{folderName}&rdquo;?
        </h3>
        {imageCount > 0 ? (
          <>
            <p className="text-[11px] text-text-secondary mb-3">
              This folder contains {imageCount} image{imageCount !== 1 ? 's' : ''}.
              What would you like to do with them?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="h-[32px] px-3 rounded text-[11px] bg-app-base border border-border text-text-primary hover:border-accent transition-colors text-left"
                onClick={() => onConfirm(false)}
              >
                Move images to root and delete folder
              </button>
              <button
                type="button"
                className="h-[32px] px-3 rounded text-[11px] bg-red-600/20 border border-red-600/30 text-red-400 hover:bg-red-600/30 transition-colors text-left"
                onClick={() => onConfirm(true)}
              >
                Delete folder and all images
              </button>
              <button
                type="button"
                className="h-[28px] px-3 rounded text-[11px] text-text-dim hover:text-text-primary transition-colors"
                onClick={onCancel}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-text-secondary mb-3">
              This folder is empty. It will be permanently deleted.
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
                onClick={() => onConfirm(false)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
