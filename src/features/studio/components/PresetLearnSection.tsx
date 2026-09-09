import { useState } from 'react';
import { BookOpenCheck } from 'lucide-react';

interface Props {
  presetId: string | undefined;
  presetName?: string;
  /** The Assistant is mid-run — the same document is being edited. */
  agentBusy: boolean;
  /** Resolves to an error line, or null when the card was queued. */
  onLearn: () => Promise<string | null>;
}

/**
 * Inspector → Project: the editing preset by name and the "Learn from this
 * video" button (W5). The button measures the CURRENT timeline against the
 * preset and puts the differences on a card in the Assistant tab; nothing
 * changes until the user accepts it there.
 */
export function PresetLearnSection({ presetId, presetName, agentBusy, onLearn }: Props) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const learn = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const error = await onLearn();
      setStatus(
        error
          ? { kind: 'error', text: error }
          : { kind: 'ok', text: 'Card ready in the Assistant tab — accept it there to update the preset.' },
      );
    } finally {
      setBusy(false);
    }
  };

  const label = presetId ? (presetName ?? `${presetId} (missing)`) : 'None';

  return (
    <div className="flex flex-col gap-1" data-preset-learn-section>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-muted">
          Preset <span className="text-text-primary">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => void learn()}
          disabled={!presetId || busy || agentBusy}
          data-preset-learn
          title={
            presetId
              ? 'Measure this edit (cuts, shots, sound, captions, intro/outro) against the preset and propose the changes as a card'
              : 'Pick a preset in the media pool (beside the brand) first'
          }
          className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-40"
        >
          <BookOpenCheck size={11} strokeWidth={1.5} />
          {busy ? 'Measuring…' : 'Learn from this video'}
        </button>
      </div>
      {status && (
        <div
          className={`text-[10px] leading-snug ${status.kind === 'error' ? 'text-accent-red' : 'text-text-dim'}`}
          data-preset-learn-status
        >
          {status.text}
        </div>
      )}
    </div>
  );
}
