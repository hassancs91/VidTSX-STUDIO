interface DescribeConsentDialogProps {
  /** How many assets the pending batch would send. */
  count: number;
  /** The app-default provider that would receive them. */
  providerId: string;
  onAllow: () => void;
  onCancel: () => void;
}

/**
 * The one-time consent (ASSET_LIBRARY_DESIGN.md L2 Rev 2). Describing
 * uploads the image itself to a cloud provider, which is a different act
 * from anything else the library does locally — so it is asked once,
 * explicitly, before the first AI describe of either kind (batch or
 * auto-on-import), and never again.
 *
 * Main enforces it too: a describe batch is refused outright until the
 * consent exists, so this dialog is the gate rather than a courtesy.
 */
export function DescribeConsentDialog({
  count,
  providerId,
  onAllow,
  onCancel,
}: DescribeConsentDialogProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      data-consent-dialog
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[400px] p-4 rounded-md bg-app-surface flex flex-col gap-3"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div className="text-[13px] font-medium text-text-primary">
          Describe with AI sends images to the cloud
        </div>
        <div className="text-[11px] leading-[1.6] text-text-secondary">
          {count === 1 ? 'This image' : `These ${count} images`} will be uploaded to
          your configured AI provider (<span className="text-text-primary">{providerId}</span>)
          so it can write {count === 1 ? 'a description' : 'descriptions'}. Only the
          image and its filename are sent. You will only be asked this once —
          descriptions you type yourself never leave your machine.
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-[12px] text-text-secondary hover:bg-app-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAllow}
            data-consent-allow
            className="px-3 py-1.5 rounded bg-accent text-white text-[12px] font-medium hover:opacity-90"
          >
            Allow and describe
          </button>
        </div>
      </div>
    </div>
  );
}
