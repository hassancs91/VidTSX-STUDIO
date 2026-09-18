import { memo } from 'react';
import { formatDuration } from '../../services/format-time';
import type { TranscriptDeletion, TranscriptParagraph as Paragraph } from '../../services/transcript-doc';
import { DeletionPill } from './DeletionPill';

interface Props {
  paragraph: Paragraph;
  showDeletions: boolean;
  readOnly: boolean;
  onSeek: (seconds: number) => void;
  onRestore: (deletion: TranscriptDeletion) => void;
}

// `data-active` is set by useTranscriptKaraoke, straight on the DOM node.
const WORD =
  'rounded-[2px] cursor-pointer hover:bg-app-hover data-[active=true]:bg-accent/35 data-[active=true]:text-text-primary';
const FILLER = `${WORD} text-accent-amber`;

/**
 * One take of the transcript. Every word is <span data-i>word </span> with its
 * trailing space INSIDE the span — transcript-selection.ts depends on it, and
 * the panel's single click handler finds the word through `data-i`.
 *
 * `content-visibility` lets the browser skip layout for the takes that are
 * scrolled away, which is what keeps a three-hour transcript scrollable.
 */
export const TranscriptParagraph = memo(function TranscriptParagraph({
  paragraph,
  showDeletions,
  readOnly,
  onSeek,
  onRestore,
}: Props) {
  return (
    <div className="mb-[12px]" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 72px' }}>
      <button
        type="button"
        onClick={() => onSeek(paragraph.start)}
        className="select-none block mb-[2px] text-[10px] font-mono text-text-dim hover:text-accent-light"
        title="Jump to the start of this take"
      >
        {formatDuration(Math.floor(paragraph.start))}
      </button>
      <p className="text-[12px] leading-[1.75] text-text-secondary">
        {paragraph.items.map((item) =>
          item.kind === 'word' ? (
            <span key={item.token.index} data-i={item.token.index} className={item.token.filler ? FILLER : WORD}>
              {item.token.text}{' '}
            </span>
          ) : showDeletions ? (
            <DeletionPill key={item.deletion.id} deletion={item.deletion} readOnly={readOnly} onRestore={onRestore} />
          ) : null,
        )}
      </p>
    </div>
  );
});
