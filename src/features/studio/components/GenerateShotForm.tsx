import { useState } from 'react';
import { Button } from '@shared/components/Button';
import { Select } from '@shared/components/Select';
import type { BuildBudget } from '@shared/ipc/types';
import { BUDGET_CHOICES, budgetHint } from '@shared/tsx-engine/build-budgets';
import { useBuildCostEstimate } from '@shared/hooks/useBuildCostEstimate';

export interface GenerateShotSpec {
  kind: 'cutaway' | 'overlay';
  brief: string;
  durationSeconds: number;
  /** How long the TSX builder may work on it (P3 part 5). */
  budget: BuildBudget;
}

interface Props {
  onGenerate: (spec: GenerateShotSpec) => void;
  /** The project's provider and shot model: the hint's cost estimate (P5 part 3). */
  providerId?: string;
  model?: string;
}

/**
 * "Generate a shot from a brief" (D10). The brand and preset it generates
 * against are project settings now (feedback item 7.4, Project settings in
 * the top bar). The Shots tab stays mounted while hidden, so a half-typed
 * brief survives a tab switch.
 */
export function GenerateShotForm({ onGenerate, providerId, model }: Props) {
  const [kind, setKind] = useState<'cutaway' | 'overlay'>('cutaway');
  const [brief, setBrief] = useState('');
  const [duration, setDuration] = useState('5');
  const [budget, setBudget] = useState<BuildBudget>('standard');
  const cost = useBuildCostEstimate(providerId, model, budget);

  const submit = () => {
    const trimmed = brief.trim();
    const seconds = Number(duration);
    if (!trimmed || !(seconds > 0)) return;
    onGenerate({ kind, brief: trimmed, durationSeconds: seconds, budget });
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
        <div className="w-[112px]" title={budgetHint(budget, cost)} data-shot-budget>
          <Select value={budget} onChange={(v) => setBudget(v as BuildBudget)} options={BUDGET_CHOICES} />
        </div>
        <Button variant="primary" size="sm" disabled={!brief.trim()} onClick={submit}>
          Generate
        </Button>
      </div>
      <p className="text-[9px] text-text-dim leading-snug">
        {BUDGET_CHOICES.find((c) => c.value === budget)?.label}: {budgetHint(budget, cost)}. The builder looks at its frames and
        fixes them, one build at a time. The clip lands at the playhead when it finishes. For word-synced titles, ask the
        Assistant.
      </p>
    </div>
  );
}
