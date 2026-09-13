import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';

export interface GenerateShotSpec {
  kind: 'cutaway' | 'overlay';
  brief: string;
  durationSeconds: number;
}

interface Props {
  onGenerate: (spec: GenerateShotSpec) => void;
}

/**
 * "Generate a shot from a brief" (D10). The brand and preset it generates
 * against are project settings now (feedback item 7.4, Project settings in
 * the top bar). The Shots tab stays mounted while hidden, so a half-typed
 * brief survives a tab switch.
 */
export function GenerateShotForm({ onGenerate }: Props) {
  const [kind, setKind] = useState<'cutaway' | 'overlay'>('cutaway');
  const [brief, setBrief] = useState('');
  const [duration, setDuration] = useState('5');

  const submit = () => {
    const trimmed = brief.trim();
    const seconds = Number(duration);
    if (!trimmed || !(seconds > 0)) return;
    onGenerate({ kind, brief: trimmed, durationSeconds: seconds });
    setBrief('');
  };

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded-[6px] bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-generate-shot-form
    >
      <Select
        value={kind}
        onChange={(v) => setKind(v as 'cutaway' | 'overlay')}
        options={[
          { value: 'cutaway', label: 'Cutaway (covers the footage)' },
          { value: 'overlay', label: 'Overlay (transparent, on top)' },
        ]}
      />
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="What should the shot show?"
        rows={3}
        data-shot-brief
        className="bg-app-base text-text-primary rounded-[6px] px-[8px] py-[6px] text-[11px] focus:outline-none resize-none"
        style={{ border: '0.5px solid var(--color-border-input)' }}
      />
      <div className="flex items-center gap-2">
        <input
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          data-shot-duration
          className="w-[48px] bg-app-base text-text-primary rounded-[6px] px-[8px] h-[24px] text-[11px] focus:outline-none"
          style={{ border: '0.5px solid var(--color-border-input)' }}
        />
        <span className="text-[10px] text-text-dim">seconds</span>
        <div className="flex-1" />
        <Button variant="primary" size="sm" disabled={!brief.trim()} onClick={submit}>
          Generate
        </Button>
      </div>
      <p className="text-[9px] text-text-dim leading-snug">
        The clip lands at the playhead when generation finishes. For word-synced titles, ask the Assistant.
      </p>
    </div>
  );
}
