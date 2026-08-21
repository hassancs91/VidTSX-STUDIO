import { useEffect, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import type { StudioProjectSnapshotInfo } from '@shared/ipc/types';

interface Props {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Resolves true when the restore applied — the dialog closes itself. */
  onRestore: (file: string, savedAt: string) => Promise<boolean>;
}

/** "Restore version…" picker (Q10): rotating snapshots listed newest first,
 *  each restorable behind an inline two-step confirm (CDP-drivable, no native
 *  dialog). Restoring snapshots the current state first, so every restore is
 *  itself undoable from this same list. */
export function RestoreVersionDialog({ projectId, isOpen, onClose, onRestore }: Props) {
  const [snapshots, setSnapshots] = useState<StudioProjectSnapshotInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armedFile, setArmedFile] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    setArmedFile(null);
    setError(null);
    setLoading(true);
    let disposed = false;
    void window.api.studioProjectSnapshotList({ id: projectId }).then((res) => {
      if (disposed) return;
      setLoading(false);
      if (res.success) setSnapshots(res.snapshots ?? []);
      else setError(res.error ?? 'Failed to list versions');
    });
    return () => {
      disposed = true;
    };
  }, [isOpen, projectId]);

  const handleRestore = async (file: string, savedAt: string) => {
    setRestoring(true);
    const ok = await onRestore(file, savedAt);
    setRestoring(false);
    if (ok) onClose();
    else setArmedFile(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Restore version">
      <div
        className="w-[440px] max-h-[60vh] overflow-y-auto flex flex-col gap-2"
        data-restore-dialog
      >
        <p className="text-[11px] text-text-dim leading-snug">
          Snapshots are taken when the project opens and every 10 minutes of editing. Restoring
          saves the current state as a new snapshot first, so a restore can always be undone from
          this list.
        </p>

        {loading && <div className="text-[11px] text-text-dim">Loading…</div>}
        {!loading && !error && snapshots.length === 0 && (
          <div className="text-[11px] text-text-dim">
            No snapshots yet — they appear as you edit.
          </div>
        )}

        {snapshots.map((snap) => (
          <div
            key={snap.file}
            className="flex items-center gap-2 p-2 rounded-[6px] bg-app-base"
            style={{ border: '0.5px solid var(--color-border)' }}
            data-snapshot-row={snap.file}
          >
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-text-primary">{formatSavedAt(snap.savedAt)}</div>
              <div className="text-[9px] text-text-ghost">{formatSize(snap.sizeBytes)}</div>
            </div>
            {armedFile === snap.file ? (
              <>
                <button
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:bg-app-hover"
                  onClick={() => setArmedFile(null)}
                  disabled={restoring}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  data-restore-confirm
                  className="px-2 py-0.5 rounded text-[10px] text-accent-red hover:bg-app-hover"
                  onClick={() => void handleRestore(snap.file, snap.savedAt)}
                  disabled={restoring}
                >
                  {restoring ? 'Restoring…' : 'Replace current'}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="px-2 py-0.5 rounded text-[10px] text-accent-blue hover:bg-app-hover"
                onClick={() => setArmedFile(snap.file)}
                disabled={restoring}
              >
                Restore
              </button>
            )}
          </div>
        ))}

        {error && <div className="text-[10px] text-accent-red leading-snug">{error}</div>}
      </div>
    </Modal>
  );
}

export function formatSavedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
