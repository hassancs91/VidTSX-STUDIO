import { useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import type { StudioPresetKnobChange, StudioPresetUpdateProposal } from '@shared/types/studio-preset';

interface Props {
  proposal: StudioPresetUpdateProposal;
  error: string | null;
  resolving: boolean;
  onAccept: () => void;
  onReject: () => void;
}

const KNOB_LABEL: Record<StudioPresetKnobChange['key'], string> = {
  pacing: 'Pacing',
  shotsPerMinute: 'Shots / min',
  sfxPerMinute: 'SFX / min',
  musicBed: 'Music bed',
  captions: 'Captions',
  transitions: 'Transitions',
  introSeconds: 'Intro (s)',
  outroSeconds: 'Outro (s)',
};

function knobValue(v: string | number | string[] | undefined): string {
  if (v === undefined) return 'unset';
  if (Array.isArray(v)) return v.length > 0 ? v.join(', ') : 'none';
  return String(v);
}

/** The pending "learn from this video" card (W5): the measured edit against
 *  the preset — a knob diff with the numbers behind each row, and the
 *  "Learned from" section accept appends to PRESET.md. One click writes the
 *  preset; nothing is inferred silently. */
export function PresetUpdateCard({ proposal, error, resolving, onAccept, onReject }: Props) {
  const [showSection, setShowSection] = useState(false);
  const changes = proposal.knobChanges;

  return (
    <div
      className="rounded-[8px] bg-app-base p-2.5 space-y-1.5"
      style={{ border: '0.5px solid var(--color-accent-blue, #4f8cff)' }}
      data-preset-update-proposal={proposal.id}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-accent-blue">
        <BookOpenCheck size={11} strokeWidth={1.75} className="shrink-0" />
        <span className="font-medium">Update the preset from this edit?</span>
        <span className="text-text-ghost truncate">· {proposal.presetName}</span>
      </div>

      {proposal.note && <div className="text-[10px] text-text-dim leading-snug">{proposal.note}</div>}

      <div className="text-[11px] text-text-primary leading-snug" data-preset-update-summary>
        {proposal.summary}
        {proposal.summaryFallback && (
          <span className="text-[10px] text-text-ghost"> (numbers only — no summary model was available)</span>
        )}
      </div>

      <div className="text-[10px] text-text-dim leading-snug">{proposal.statsSummary}</div>

      {changes.length > 0 ? (
        <table className="w-full text-[10px] leading-snug" data-preset-update-knobs>
          <tbody>
            {changes.map((change) => (
              <tr key={change.key} className="align-top">
                <td className="pr-2 text-text-muted whitespace-nowrap">{KNOB_LABEL[change.key]}</td>
                <td className="pr-2 text-text-primary whitespace-nowrap">
                  <span className="text-text-ghost line-through">{knobValue(change.from)}</span>
                  {' → '}
                  <span className="font-medium">{knobValue(change.to)}</span>
                </td>
                <td className="text-text-dim">{change.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-[10px] text-text-dim">Knobs unchanged — the edit matched the preset; only the notes grow.</div>
      )}

      <button
        type="button"
        onClick={() => setShowSection((v) => !v)}
        className="text-[10px] text-text-muted hover:text-text-secondary"
        data-preset-update-toggle-section
      >
        {showSection ? 'Hide' : 'Show'} the section this adds to PRESET.md
      </button>
      {showSection && (
        <pre
          className="text-[10px] text-text-dim whitespace-pre-wrap leading-snug max-h-[180px] overflow-y-auto rounded bg-app-surface p-1.5"
          data-preset-update-section
        >
          {proposal.learnedSection}
        </pre>
      )}

      {error && (
        <div className="text-[10px] text-accent-red leading-snug" data-preset-update-error>
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-1 pt-0.5">
        <button
          type="button"
          onClick={onReject}
          disabled={resolving}
          data-preset-update-reject
          className="px-2 py-1 rounded-[5px] text-[10px] transition-colors disabled:opacity-40 text-text-muted hover:bg-app-hover hover:text-text-secondary"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={resolving}
          data-preset-update-accept
          className="px-2 py-1 rounded-[5px] text-[10px] font-medium transition-colors disabled:opacity-40 bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25"
        >
          Update preset
        </button>
      </div>
    </div>
  );
}
