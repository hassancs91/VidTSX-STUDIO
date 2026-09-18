import { useState } from 'react';
import { Undo2 } from 'lucide-react';
import type { TranscriptDeletion } from '../../services/transcript-doc';

interface Props {
  deletion: TranscriptDeletion;
  readOnly: boolean;
  onRestore: (deletion: TranscriptDeletion) => void;
}

/**
 * Text that was cut out at a join, shown where it used to be: a collapsed
 * `¶ 3.2s` chip that opens to the struck-through words and a Restore. It is
 * `select-none` throughout, so a text selection dragged across it selects the
 * kept words on both sides and never the deleted ones.
 */
export function DeletionPill({ deletion, readOnly, onRestore }: Props) {
  const [open, setOpen] = useState(false);
  const label = `${deletion.seconds.toFixed(1)}s`;

  if (!open) {
    return (
      <button
        type="button"
        data-deletion={deletion.id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title={`Deleted: “${deletion.text}” — click to show`}
        className="select-none inline-flex items-center align-baseline mx-[2px] px-[5px] h-[15px] rounded-[4px] text-[9px] leading-none text-text-dim bg-app-hover hover:text-text-secondary hover:bg-app-active transition-colors"
      >
        ¶ {label}
      </button>
    );
  }

  return (
    <span
      data-deletion={deletion.id}
      data-open="true"
      className="select-none inline align-baseline mx-[2px] px-[5px] py-[1px] rounded-[4px] bg-app-hover"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen(false)}
        title="Hide the deleted text"
        className="text-text-dim line-through decoration-text-ghost hover:text-text-muted"
      >
        {deletion.text}
      </button>
      <span className="ml-[6px] text-[9px] text-text-dim">{label}</span>
      {!readOnly && (
        <button
          type="button"
          data-restore={deletion.id}
          onClick={() => onRestore(deletion)}
          title="Put this text back on the timeline"
          className="ml-[6px] inline-flex items-center gap-[3px] text-[10px] text-accent-light hover:underline"
        >
          <Undo2 size={10} strokeWidth={1.75} />
          Restore
        </button>
      )}
    </span>
  );
}
