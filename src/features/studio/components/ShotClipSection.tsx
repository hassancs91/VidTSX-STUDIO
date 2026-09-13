// Inspector section for a selected tsx clip (D10): the shot behind it —
// name/kind/anchor readout, folder-scanned version picker (undoable pointer
// flip), edit-instruction box (→ editTsxPipeline, next version), Regenerate,
// and "Resize clip to shot length" when the clip and config disagree.

import { useEffect, useState } from 'react';
import { Button } from '@shared/components/Button';
import { CopyButton } from '@shared/components/CopyButton';
import { Select } from '@shared/components/Select';
import { TextInput } from '@shared/components/TextInput';
import type { StudioClip, StudioShot } from '../types';
import type { TimelineAction } from '../hooks/useTimeline';
import type { ShotJobProgress } from '../hooks/useShotJobs';

interface Props {
  projectId: string;
  clip: StudioClip;
  shot: StudioShot | null;
  dispatch: React.Dispatch<TimelineAction>;
  progress: ShotJobProgress | null;
  onError: (message: string) => void;
}

function fmtSpan(start: number, end: number): string {
  return `${start.toFixed(2)}–${end.toFixed(2)} s`;
}

export function ShotClipSection({ projectId, clip, shot, dispatch, progress, onError }: Props) {
  const [versions, setVersions] = useState<number[]>([]);
  const [instruction, setInstruction] = useState('');
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
      })
      .then((res) => {
        if (!res.success) onError(res.error ?? 'Failed to start the edit');
      });
  };

  // Q5: one critique-and-revise round per click — stills of the current
  // version go to the vision model, the revision lands as the next version.
  const refine = () => {
    if (busy || shot.status !== 'ready') return;
    void window.api
      .studioShotGenerate({
        projectId,
        op: 'refine',
        shotId: shot.id,
        activeVersion: shot.activeVersion,
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
        ...(shot.anchor ? { anchor: shot.anchor } : {}),
        ...(shot.assetRefs ? { assetRefs: shot.assetRefs } : {}),
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

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy || !instruction.trim()} onClick={sendEdit}>
          Apply edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || !shot.prompt}
          onClick={regenerate}
          title={shot.prompt ? 'Fresh take with the original brief (re-bakes word sync)' : 'No stored brief to regenerate from'}
        >
          Regenerate
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || shot.status !== 'ready'}
          onClick={refine}
          title="Render stills of this version and run one critique-and-revise pass (vision provider)"
        >
          Refine
        </Button>
      </div>

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
