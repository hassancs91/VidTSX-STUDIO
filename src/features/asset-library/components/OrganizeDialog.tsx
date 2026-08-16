import type { LibraryOrganizeMove, LibraryOrganizeSkip } from '@shared/ipc/types';
import type { OrganizePlanState } from '../hooks/useLibraryOrganize';

interface OrganizeDialogProps {
  plan: OrganizePlanState;
  applying: boolean;
  error: string | null;
  onToggle: (relPath: string) => void;
  onSetAll: (accepted: boolean) => void;
  onApply: () => void;
  onClose: () => void;
}

const folderLabel = (folder: string) => (folder === '' ? 'library root' : `${folder}/`);

const fileName = (relPath: string) => relPath.slice(relPath.lastIndexOf('/') + 1);

/**
 * The organize review gate (ASSET_LIBRARY_DESIGN.md L7): bulk file changes
 * get the same per-item accept/reject as bulk timeline changes, and nothing
 * touches disk until Apply.
 *
 * The skipped list is shown as its own section rather than hidden. An asset
 * the open Studio project references cannot move safely mid-session (L7 Rev
 * 2), and the user can act on that — closing the project makes the move
 * available on the next run — so the reason has to be visible, not silent.
 */
export function OrganizeDialog({
  plan,
  applying,
  error,
  onToggle,
  onSetAll,
  onApply,
  onClose,
}: OrganizeDialogProps) {
  const acceptedCount = plan.moves.filter((m) => plan.accepted.has(m.relPath)).length;
  const allAccepted = acceptedCount === plan.moves.length && plan.moves.length > 0;
  const nothingToDo = plan.moves.length === 0 && plan.skipped.length === 0;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50"
      onClick={applying ? undefined : onClose}
      data-organize-dialog
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-h-[80vh] rounded-md bg-app-surface flex flex-col"
        style={{ border: '0.5px solid var(--color-border)' }}
      >
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '0.5px solid var(--color-border)' }}
        >
          <span className="text-[13px] font-medium text-text-primary">Organize library</span>
          <span className="text-[10px] text-text-dim">
            {plan.moves.length} proposed
            {plan.skipped.length > 0 ? ` · ${plan.skipped.length} skipped` : ''}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3 flex flex-col gap-4">
          {nothingToDo && (
            <div className="py-8 text-center text-[12px] text-text-dim">
              Nothing to reorganize — the library already looks well filed.
            </div>
          )}

          {plan.moves.length > 0 && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">Proposed moves</span>
                <button
                  type="button"
                  onClick={() => onSetAll(!allAccepted)}
                  className="text-[10px] text-text-muted hover:text-text-primary"
                >
                  {allAccepted ? 'Reject all' : 'Accept all'}
                </button>
              </div>
              {plan.moves.map((move) => (
                <MoveRow
                  key={move.relPath}
                  move={move}
                  accepted={plan.accepted.has(move.relPath)}
                  onToggle={() => onToggle(move.relPath)}
                />
              ))}
            </section>
          )}

          {plan.skipped.length > 0 && (
            <section className="flex flex-col gap-2" data-organize-skipped>
              <span className="text-[11px] text-text-muted">
                Skipped — in use by the open project
              </span>
              <div className="text-[10px] leading-[1.5] text-text-dim">
                These files are referenced by the Studio project you have open.
                Moving them now would break that session — close the project and
                run Organize again.
              </div>
              {plan.skipped.map((skip) => (
                <SkipRow key={skip.relPath} skip={skip} />
              ))}
            </section>
          )}

          {plan.discarded > 0 && (
            <div className="text-[10px] text-text-dim">
              {plan.discarded} suggestion{plan.discarded === 1 ? '' : 's'} discarded as unusable
              (unknown file, name collision, or no change).
            </div>
          )}

          {error && <div className="text-[11px] text-red-400">{error}</div>}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-4 py-2.5"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="px-3 py-1.5 rounded text-[12px] text-text-secondary hover:bg-app-hover disabled:opacity-50"
          >
            {nothingToDo ? 'Close' : 'Cancel'}
          </button>
          {!nothingToDo && (
            <button
              type="button"
              onClick={onApply}
              disabled={applying || acceptedCount === 0}
              data-organize-apply
              className="px-3 py-1.5 rounded bg-accent text-white text-[12px] font-medium hover:opacity-90 disabled:opacity-40"
            >
              {applying ? 'Moving…' : `Apply ${acceptedCount} move${acceptedCount === 1 ? '' : 's'}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MoveRow({
  move,
  accepted,
  onToggle,
}: {
  move: LibraryOrganizeMove;
  accepted: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className="flex items-start gap-2.5 px-2.5 py-2 rounded bg-app-base cursor-pointer hover:bg-app-hover"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-organize-move={move.relPath}
    >
      <input
        type="checkbox"
        checked={accepted}
        onChange={onToggle}
        className="mt-0.5 accent-[var(--color-accent)]"
      />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-primary truncate">{fileName(move.relPath)}</div>
        <div className="text-[10px] text-text-muted truncate">
          {folderLabel(move.fromFolder)} → <span className="text-text-secondary">{folderLabel(move.toFolder)}</span>
        </div>
        {move.reason && <div className="text-[10px] text-text-dim mt-0.5">{move.reason}</div>}
      </div>
    </label>
  );
}

function SkipRow({ skip }: { skip: LibraryOrganizeSkip }) {
  return (
    <div
      className="flex items-start gap-2.5 px-2.5 py-2 rounded bg-app-base opacity-70"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-organize-skip={skip.relPath}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-text-secondary truncate">{fileName(skip.relPath)}</div>
        <div className="text-[10px] text-text-muted truncate">
          would move to {folderLabel(skip.toFolder)}
        </div>
      </div>
      <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] bg-app-surface text-text-muted">
        in use, close the project to move
      </span>
    </div>
  );
}
