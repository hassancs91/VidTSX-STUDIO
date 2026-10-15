// Inspector section for a selected tsx clip (D10): the shot behind it —
// name/kind/anchor readout, folder-scanned version picker (undoable pointer
// flip), edit-instruction box, Regenerate, Refine, and "Resize clip to shot
// length" when the clip and config disagree. Since P3 part 5 each op is a TSX
// builder job: Apply edit and Regenerate at the Budget picked here (default
// Standard), Refine always Quick, Cancel for whichever is running.

import { useEffect, useState } from 'react';
import { Button } from '@shared/components/Button';
import { CopyButton } from '@shared/components/CopyButton';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { BuildBudget } from '@shared/ipc/types';
import { BUDGET_CHOICES, budgetHint } from '@shared/tsx-engine/build-budgets';
import type { StudioClip, StudioMediaAsset, StudioShot } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import type { ShotJobProgress } from '../hooks/useShotJobs';
import type { ShotFootage } from '../services/shot-footage';
import { ShotMediaSection } from './ShotMediaSection';

interface Props {
  projectId: string;
  clip: StudioClip;
  shot: StudioShot | null;
  /** The project's assets, for the Media section's picker. */
  assets: StudioMediaAsset[];
  dispatch: React.Dispatch<TimelineAction>;
  progress: ShotJobProgress | null;
  /** The master footage under the clip's start: what a transparent shot's builder looks show behind it. */
  footage?: ShotFootage;
  onError: (message: string) => void;
}

function fmtSpan(start: number, end: number): string {
  return `${start.toFixed(2)}–${end.toFixed(2)} s`;
}

const OP_LABEL: Record<string, string> = { edit: 'edit', refine: 'refine', regenerate: 'regenerate', generate: 'build' };

export function ShotClipSection({ projectId, clip, shot, assets, dispatch, progress, footage, onError }: Props) {
  const [versions, setVersions] = useState<number[]>([]);
  const [instruction, setInstruction] = useState('');
  const [budget, setBudget] = useState<BuildBudget>('standard');
  const busy = progress?.status === 'generating';

  // Folder-as-truth version list; refreshed when a run finishes (busy flips)
  // or the pointer moves.
  useEffect(() => {
    if (!shot) return;
    let cancelled = false;
    void window.api
      .studioShotVersions({ projectId, shotId: shot.id })
      .then((res) => {
        if (!cancelled && res.success && res.versions) setVersions(res.versions);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, shot?.id, shot?.activeVersion, busy, shot]);

  if (!clip.tsx) return null;
  if (!shot) {
    return (
      <div className="text-[10px] text-accent-red">
        This clip references shot &ldquo;{clip.tsx.shotId}&rdquo;, which is missing from the
        registry.
      </div>
    );
  }

  const shotSeconds = shot.config
    ? shot.config.durationInFrames / shot.config.fps
    : null;
  const mismatch = shotSeconds !== null && Math.abs(shotSeconds - clip.duration) > 0.05;
  // What the registry knows now (main's project.json lags the autosave), and the footage under the clip.
  const facts = {
    kind: shot.kind,
    ...(shot.prompt ? { brief: shot.prompt } : {}),
    ...(shot.anchor ? { anchor: shot.anchor } : {}),
    ...(shot.assetRefs ? { assetRefs: shot.assetRefs } : {}),
    ...(footage ? { footage } : {}),
  };

  const sendEdit = () => {
    const trimmed = instruction.trim();
    if (!trimmed || busy) return;
    setInstruction('');
    void window.api
      .studioShotGenerate({
        projectId,
        op: 'edit',
        shotId: shot.id,
        activeVersion: shot.activeVersion,
        instruction: trimmed,
        budget,
        ...facts,
      })
      .then((res) => {
        if (!res.success) onError(res.error ?? 'Failed to start the edit');
      });
  };

  // Q5: one Quick builder edit per click — it looks at the current
  // version's frames and fixes what it sees; the result is the next version.
  const refine = () => {
    if (busy || shot.status !== 'ready') return;
    void window.api
      .studioShotGenerate({
        projectId,
        op: 'refine',
        shotId: shot.id,
        activeVersion: shot.activeVersion,
        ...facts,
      })
      .then((res) => {
        if (!res.success) onError(res.error ?? 'Failed to start the refine pass');
      });
  };

  const regenerate = () => {
    if (busy || !shot.prompt) return;
    void window.api
      .studioShotGenerate({
        projectId,
        op: 'regenerate',
        shotId: shot.id,
        kind: shot.kind,
        brief: shot.prompt,
        name: shot.name,
        budget,
        ...(shot.anchor ? { anchor: shot.anchor } : {}),
        ...(shot.assetRefs ? { assetRefs: shot.assetRefs } : {}),
        ...(footage ? { footage } : {}),
        ...(shot.config
          ? { durationSeconds: shot.config.durationInFrames / shot.config.fps }
          : {}),
      })
      .then((res) => {
        if (!res.success) onError(res.error ?? 'Failed to start the regenerate');
      });
  };

  return (
    <div className="flex flex-col gap-2" data-shot-section={shot.id}>
      <div className="flex items-center gap-[6px]">
        <span className="text-[11px] text-text-primary truncate">{shot.name}</span>
        <CopyButton value={shot.id} title="Copy shot id (what the assistant's tools take)" size={20} />
        <span className="text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full bg-accent/20 text-accent-light">
          {shot.kind}
        </span>
        {shot.status === 'error' && (
          <span className="text-[8px] font-bold uppercase tracking-wide px-[5px] py-[1px] rounded-full bg-accent-red/15 text-accent-red">
            error
          </span>
        )}
      </div>

      <div className="text-[10px] text-text-muted">
        {shot.anchor
          ? `Synced to ${fmtSpan(shot.anchor.sourceStart, shot.anchor.sourceEnd)} of the source — cutting the master under this span desyncs the words; Regenerate re-bakes.`
          : 'Not word-synced (no anchor).'}
      </div>
      {shot.status === 'error' && shot.error && (
        <div className="text-[10px] text-accent-red leading-snug">{shot.error}</div>
      )}

      {busy && (
        <div className="text-[10px] text-accent-light" data-shot-busy={shot.id}>
          {progress?.message ?? 'Working…'}
          {progress?.percent !== undefined ? ` ${progress.percent}%` : ''}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-text-dim">Version</span>
        <Select
          value={String(shot.activeVersion)}
          onChange={(v) => {
            const version = Number(v);
            if (version !== shot.activeVersion) {
              dispatch({ type: 'shot-set-version', shotId: shot.id, version });
            }
          }}
          options={(versions.length > 0 ? versions : [shot.activeVersion]).map((v) => ({
            value: String(v),
            label: `v${v}`,
          }))}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-text-dim">Edit the shot</span>
        <TextInput
          value={instruction}
          placeholder="e.g. make the accent amber, slow the reveal"
          disabled={busy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendEdit();
          }}
        />
      </label>

      <label className="flex items-center gap-2" title={budgetHint(budget)}>
        <span className="text-[10px] text-text-dim shrink-0">Budget</span>
        <div className="w-[124px] shrink-0" data-shot-inspector-budget>
          <Select value={budget} disabled={busy} onChange={(v) => setBudget(v as BuildBudget)} options={BUDGET_CHOICES} />
        </div>
        <span className="text-[9px] text-text-dim truncate">{budgetHint(budget)} · Apply edit, Regenerate</span>
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="secondary" size="sm" disabled={busy || !instruction.trim()} onClick={sendEdit}>
          Apply edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !shot.prompt}
          onClick={regenerate}
          title={shot.prompt ? 'A fresh build from the original brief, saved as the next version (re-bakes word sync)' : 'No stored brief to regenerate from'}
        >
          Regenerate
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || shot.status !== 'ready'}
          onClick={refine}
          title="A Quick builder edit: it looks at this version's frames and fixes only what they show (spacing, legibility, anything clipped), saved as the next version"
        >
          Refine
        </Button>
        {busy && (
          <Button
            variant="secondary"
            size="sm"
            data-shot-inspector-cancel
            onClick={() => void window.api.studioShotCancel({ projectId, shotId: shot.id })}
            title={`Stop the ${OP_LABEL[progress?.op ?? ''] ?? 'build'} — the current version is kept`}
          >
            Cancel
          </Button>
        )}
      </div>

      <ShotMediaSection
        shot={shot}
        assets={assets}
        disabled={busy}
        onChange={(assetRefs) => dispatch({ type: 'shot-set-asset-refs', shotId: shot.id, assetRefs })}
      />

      {mismatch && shotSeconds !== null && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            // Trim the end edge to the shot's own length — trimClip clamps
            // against neighbours, so this can never create an overlap.
            dispatch({
              type: 'trim',
              clipId: clip.id,
              edge: 'end',
              seconds: clip.timelineStart + shotSeconds,
            })
          }
          title={`The clip is ${clip.duration.toFixed(1)} s but the shot runs ${shotSeconds.toFixed(1)} s`}
        >
          Resize clip to shot length ({shotSeconds.toFixed(1)} s)
        </Button>
      )}
    </div>
  );
}
