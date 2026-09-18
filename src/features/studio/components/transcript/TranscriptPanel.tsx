// The Transcript panel (NEXT_FEATURES_DESIGN.md Q5a): the master lane's edit
// as text, beside the preview — read along, click a word to go there, select
// words and delete them, bring deleted text back.
//
// It renders `useTextEdit`'s document and owns nothing but view state: the
// native text selection, the show-deletions choice, the karaoke attribute.

import { useCallback, useMemo, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Eye, EyeOff, FileText, Play, Trash2 } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { useTranscriptKaraoke } from '../../hooks/useTranscriptKaraoke';
import { useTranscriptSelection } from '../../hooks/useTranscriptSelection';
import type { UsePlaybackResult } from '../../hooks/usePlayback';
import type { UseTextEditResult } from '../../hooks/useTextEdit';
import { TranscriptParagraph } from './TranscriptParagraph';

interface Props {
  edit: UseTextEditResult;
  playback: UsePlaybackResult;
  /** Audition a stretch of the timeline and stop (the cut review's play-span). */
  onPlaySpan: (start: number, end: number) => void;
}

const DELETIONS_CHOICES = ['show', 'hide'] as const;

export function TranscriptPanel({ edit, playback, onPlaySpan }: Props) {
  const { doc, readOnly, readOnlyReason, untranscribedCount } = edit;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selection = useTranscriptSelection(rootRef);
  const [deletions, setDeletions] = useStoredChoice('studio.transcript.deletions', DELETIONS_CHOICES, 'show');
  const showDeletions = deletions === 'show';
  useTranscriptKaraoke(rootRef, doc.tokens, playback, selection.range !== null);

  const range = selection.range;
  const selected = useMemo(
    () => (range ? doc.tokens.slice(range.from, range.to + 1) : []),
    [range, doc.tokens],
  );
  const fillers = useMemo(() => edit.fillersIn(range), [edit, range]);

  const deleteSelection = useCallback(() => {
    if (range && edit.deleteRange(range)) selection.clear();
  }, [range, edit, selection]);

  const deleteFillers = useCallback(() => {
    if (edit.deleteFillers(range)) selection.clear();
  }, [range, edit, selection]);

  // One handler for every word: a click that did not select anything seeks.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!window.getSelection()?.isCollapsed) return;
      const word = (event.target as HTMLElement).closest<HTMLElement>('[data-i]');
      const token = word ? doc.tokens[Number(word.dataset.i)] : undefined;
      if (token) playback.seek(token.start);
    },
    [doc.tokens, playback],
  );

  // Delete belongs to the selection while there is one — stopping it here keeps
  // the editor's window-level shortcut from deleting the selected CLIPS too.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && range) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelection();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && rootRef.current) {
        event.preventDefault();
        event.stopPropagation();
        window.getSelection()?.selectAllChildren(rootRef.current);
      } else if (event.key === 'Escape' && range) {
        event.stopPropagation();
        selection.clear();
      }
    },
    [range, deleteSelection, selection],
  );

  const hasWords = doc.tokens.length > 0;
  const selectedSeconds = selected.length > 0 ? selected[selected.length - 1].end - selected[0].start : 0;

  return (
    <div className="flex flex-col h-full bg-app-deep" data-transcript-panel>
      <div
        className="flex items-center gap-[6px] h-[30px] shrink-0 px-[10px]"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] text-text-muted">
          {hasWords ? `${doc.tokens.length.toLocaleString()} words` : 'Transcript'}
        </span>
        <div className="flex-1" />
        {doc.fillerCount > 0 && !range && (
          <button
            type="button"
            data-transcript-action="remove-all-fillers"
            disabled={readOnly}
            onClick={deleteFillers}
            title="Cut every um / uh in the edit, edges snapped to the audio"
            className="text-[10px] text-accent-amber hover:underline disabled:opacity-40 disabled:no-underline"
          >
            Remove {doc.fillerCount} filler{doc.fillerCount === 1 ? '' : 's'}
          </button>
        )}
        {doc.deletions.length > 0 && (
          <button
            type="button"
            data-transcript-action="toggle-deletions"
            aria-pressed={showDeletions}
            onClick={() => setDeletions(showDeletions ? 'hide' : 'show')}
            title={showDeletions ? 'Hide deleted text' : `Show deleted text (${doc.deletions.length})`}
            className="flex items-center text-text-dim hover:text-text-secondary"
          >
            {showDeletions ? <Eye size={13} strokeWidth={1.75} /> : <EyeOff size={13} strokeWidth={1.75} />}
          </button>
        )}
      </div>

      {readOnlyReason && (
        <div className="shrink-0 px-[10px] py-[5px] text-[10px] leading-snug text-accent-blue bg-accent-blue/10">
          {readOnlyReason}
        </div>
      )}
      {untranscribedCount > 0 && (
        <div className="shrink-0 px-[10px] py-[5px] text-[10px] leading-snug text-text-dim">
          {untranscribedCount} clip{untranscribedCount === 1 ? ' has' : 's have'} no transcript — select{' '}
          {untranscribedCount === 1 ? 'it' : 'one'} and transcribe it in the Inspector to edit it here.
        </div>
      )}

      {hasWords || doc.deletions.length > 0 ? (
        <div
          ref={rootRef}
          tabIndex={0}
          data-transcript-body
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className="flex-1 min-h-0 overflow-y-auto px-[12px] py-[10px] outline-none selection:bg-accent/45"
        >
          {doc.paragraphs.map((paragraph) => (
            <TranscriptParagraph
              key={paragraph.id}
              paragraph={paragraph}
              showDeletions={showDeletions}
              readOnly={readOnly}
              onSeek={playback.seek}
              onRestore={edit.restore}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-[6px] px-[20px] text-center">
          <FileText size={40} strokeWidth={1.25} className="text-text-ghost" />
          <div className="text-[13px] text-text-muted">No transcript yet</div>
          <div className="text-[11px] leading-snug text-text-dim">
            Transcribe a clip on the master track and its words appear here — then edit the video by editing the
            text.
          </div>
        </div>
      )}

      {range && selected.length > 0 && (
        <div
          className="flex items-center gap-[6px] shrink-0 px-[10px] py-[6px] bg-app-surface"
          style={{ borderTop: '0.5px solid var(--color-border)' }}
          data-transcript-selection
        >
          <span className="text-[10px] text-text-muted truncate">
            {selected.length} word{selected.length === 1 ? '' : 's'} · {selectedSeconds.toFixed(1)} s
          </span>
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPlaySpan(selected[0].start, selected[selected.length - 1].end)}
            title="Play the selection"
            className="flex items-center"
          >
            <Play size={11} strokeWidth={1.75} />
          </Button>
          {fillers.length > 0 && fillers.length < selected.length && (
            <Button
              variant="secondary"
              size="sm"
              disabled={readOnly}
              onClick={deleteFillers}
              data-transcript-action="remove-fillers"
              title="Cut only the um / uh inside the selection"
            >
              {fillers.length} filler{fillers.length === 1 ? '' : 's'}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            disabled={readOnly}
            onClick={deleteSelection}
            data-transcript-action="delete"
            title="Delete the selected words from the video (Delete)"
            className="flex items-center gap-[4px]"
          >
            <Trash2 size={11} strokeWidth={1.75} />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
