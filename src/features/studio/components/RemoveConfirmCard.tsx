import { TriangleAlert } from 'lucide-react';
import { Button } from '@shared/components/Button';

interface Props {
  /** What is about to go — the file name or the shot name. */
  name: string;
  /** The in-use line from `asset-usage.ts` ("Used by 297 clips on V1 and 2 shots."). */
  usage: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Hook for tests / CDP drivers. */
  testId?: string;
}

/**
 * The confirm shown IN PLACE of a media tile or shot row when the X is
 * clicked on something the timeline still uses (feedback item 6). Removing
 * deletes the clips; the file stays on disk; the whole thing is one undo step.
 */
export function RemoveConfirmCard({ name, usage, onConfirm, onCancel, testId }: Props) {
  return (
    <div
      data-remove-confirm={testId}
      className="flex flex-col gap-1.5 px-2 py-2 rounded-[6px] bg-app-surface"
      style={{ border: '0.5px solid var(--color-accent-amber, #f5a524)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <TriangleAlert size={12} strokeWidth={1.75} className="text-accent-amber shrink-0" />
        <span className="text-[10px] text-text-primary truncate" title={name}>
          {name}
        </span>
      </div>
      <p className="text-[10px] text-text-secondary leading-snug">
        {usage} Remove anyway? The clips are deleted; the file stays on disk. Undo restores both.
      </p>
      <div className="flex items-center gap-1.5 justify-end">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="text-accent-red hover:text-accent-red"
          onClick={onConfirm}
          data-remove-confirm-accept={testId}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
