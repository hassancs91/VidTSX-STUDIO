// Export a project as a `.vidtsx` package (Q7c export dialog).
//
// The dialog's job is honesty about size: it plans ALL THREE media strategies
// when it opens, so the tiles carry real totals instead of adjectives, and the
// asset table says per asset what travels and what does not. Nothing is written
// until Export — a plan touches no files.
//
// Exporting from the project browser (never the open editor) is deliberate,
// the Clear Cache reasoning: a package should be a picture of a saved project,
// not of a document mid-autosave.

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { ProgressBar } from '@shared/components/ProgressBar';
import { ErrorBanner } from '@shared/components/ErrorBanner';
import type { StudioPackagePlanSummary } from '@shared/ipc/types';
import type { StudioProject } from '@shared/types/studio';
import {
  formatPackageBytes,
  PACKAGE_MEDIA_STRATEGIES,
  type PackageMediaStrategy,
} from '@shared/studio/project-package';
import { usePackageProgress } from '../hooks/usePackageProgress';

const STRATEGY_COPY: Record<PackageMediaStrategy, { label: string; description: string }> = {
  full: { label: 'Full media', description: 'Self-contained. Everything opens on the other machine.' },
  'proxies-only': {
    label: 'Proxies only',
    description: '720p stand-ins for review hand-offs; import asks for a full-res relink.',
  },
  none: {
    label: 'No media',
    description: 'Tiny. Import locates each file, verified against its stored hash.',
  },
};

interface Props {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
}

type Plans = Partial<Record<PackageMediaStrategy, StudioPackagePlanSummary>>;

export function ExportPackageDialog({ isOpen, projectId, projectName, onClose }: Props) {
  const [project, setProject] = useState<StudioProject | null>(null);
  const [plans, setPlans] = useState<Plans>({});
  const [strategy, setStrategy] = useState<PackageMediaStrategy>('full');
  const [includeChat, setIncludeChat] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ filePath: string; bytes: number } | null>(null);
  const progress = usePackageProgress('export', exporting);

  const plan = plans[strategy];

  useEffect(() => {
    if (!isOpen) {
      setProject(null);
      setPlans({});
      setStrategy('full');
      setIncludeChat(false);
      setError(null);
      setDone(null);
      setExporting(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await window.api.studioProjectLoad({ id: projectId });
      if (cancelled) return;
      if (!res.success || !res.project) {
        setError(res.error ?? 'Could not read this project.');
        return;
      }
      setProject(res.project);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  // Size every strategy, so the tiles can state a real total. Re-planned when
  // the chat opt-in flips because that changes what travels.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setPlanning(true);
    void (async () => {
      const next: Plans = {};
      for (const candidate of PACKAGE_MEDIA_STRATEGIES) {
        const res = await window.api.studioPackagePlan({
          project,
          strategy: candidate,
          ...(includeChat ? { includeChat: true } : {}),
        });
        if (cancelled) return;
        if (res.success && res.plan) next[candidate] = res.plan;
        else if (res.error) setError(res.error);
      }
      if (cancelled) return;
      setPlans(next);
      setPlanning(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [project, includeChat]);

  const handleExport = useCallback(async () => {
    if (!project || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const res = await window.api.studioPackageExport({
        project,
        strategy,
        ...(includeChat ? { includeChat: true } : {}),
      });
      if (res.canceled) return;
      if (!res.success) {
        setError(res.error ?? 'The package could not be written.');
        return;
      }
      setDone({ filePath: res.filePath ?? '', bytes: res.bytes ?? 0 });
    } finally {
      setExporting(false);
    }
  }, [project, strategy, includeChat, exporting]);

  return (
    <Modal isOpen={isOpen} onClose={exporting ? () => undefined : onClose} title="Export project package">
      <div className="flex flex-col gap-4 w-[560px]" data-export-package-dialog>
        {error && <ErrorBanner message={error} />}

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="text-[13px] text-text-primary">Package written.</div>
            <div
              className="text-[11px] text-text-muted break-all rounded-[6px] px-2.5 py-2 bg-app-deep"
              style={{ border: '0.5px solid var(--color-border)' }}
              data-export-package-path
            >
              {done.filePath}
            </div>
            <div className="text-[11px] text-text-dim">
              {formatPackageBytes(done.bytes)} of project files and media.
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="text-[12px] text-text-muted">
              One file carrying <span className="text-text-secondary">{projectName}</span> — the
              timeline, its shots, transcripts and brand tokens. Proxies, waveforms and renders
              never travel; they rebuild on the other side.
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Media</span>
              <div className="grid grid-cols-3 gap-2">
                {PACKAGE_MEDIA_STRATEGIES.map((candidate) => (
                  <StrategyTile
                    key={candidate}
                    strategy={candidate}
                    plan={plans[candidate]}
                    isSelected={strategy === candidate}
                    onSelect={() => setStrategy(candidate)}
                  />
                ))}
              </div>
            </div>

            <AssetTable plan={plan} planning={planning} />

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeChat}
                onChange={(e) => setIncludeChat(e.target.checked)}
                data-export-include-chat
                className="mt-[3px]"
              />
              <span className="text-[11px] text-text-secondary">
                Include the assistant conversation
                <span className="block text-text-dim">
                  Off by default — the project chat and each shot's edit chat are private
                  conversations, not part of the work.
                </span>
              </span>
            </label>

            {plan?.warnings.map((warning) => (
              <div key={warning} className="text-[11px] text-accent-amber">
                {warning}
              </div>
            ))}

            {exporting && (
              <div className="flex flex-col gap-1.5">
                <ProgressBar value={progress.percent} />
                <span className="text-[11px] text-text-dim">
                  {progress.message || 'Writing package…'}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={exporting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleExport()}
                disabled={!project || planning || exporting}
                data-export-package-confirm
              >
                {exporting ? 'Exporting…' : `Export${plan ? ` · ${formatPackageBytes(plan.totalBytes)}` : ''}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function StrategyTile({
  strategy,
  plan,
  isSelected,
  onSelect,
}: {
  strategy: PackageMediaStrategy;
  plan?: StudioPackagePlanSummary;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const copy = STRATEGY_COPY[strategy];
  return (
    <button
      type="button"
      onClick={onSelect}
      data-export-strategy={strategy}
      className={[
        'flex flex-col gap-1 p-2.5 rounded-md text-left transition-colors',
        isSelected ? 'bg-accent/10 ring-1 ring-accent' : 'bg-app-deep hover:bg-app-hover',
      ].join(' ')}
      style={{ border: isSelected ? '0.5px solid transparent' : '0.5px solid var(--color-border)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium text-text-primary">{copy.label}</span>
        <span className="text-[10px] text-text-muted tabular-nums">
          {plan ? formatPackageBytes(plan.totalBytes) : '…'}
        </span>
      </div>
      <span className="text-[10px] text-text-dim leading-snug">{copy.description}</span>
    </button>
  );
}

function AssetTable({ plan, planning }: { plan?: StudioPackagePlanSummary; planning: boolean }) {
  if (!plan) {
    return <div className="text-[11px] text-text-dim">Sizing the project…</div>;
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {plan.counts.assets} asset{plan.counts.assets === 1 ? '' : 's'} · {plan.counts.shots} shot
          {plan.counts.shots === 1 ? '' : 's'} · {plan.counts.transcripts} transcript
          {plan.counts.transcripts === 1 ? '' : 's'}
        </span>
        <span className="text-[10px] text-text-dim tabular-nums">
          media {formatPackageBytes(plan.mediaBytes)} · project files{' '}
          {formatPackageBytes(plan.extrasBytes)}
        </span>
      </div>
      <div
        className="max-h-[168px] overflow-y-auto rounded-[6px] bg-app-deep"
        style={{ border: '0.5px solid var(--color-border)', opacity: planning ? 0.6 : 1 }}
      >
        {plan.assets.length === 0 ? (
          <div className="px-2.5 py-2 text-[11px] text-text-dim">No media in this project.</div>
        ) : (
          plan.assets.map((asset) => (
            <div
              key={asset.assetId}
              data-export-asset={asset.assetId}
              className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]"
              style={{ borderBottom: '0.5px solid var(--color-border)' }}
            >
              <span className="flex-1 truncate text-text-secondary" title={asset.name}>
                {asset.name}
              </span>
              {asset.proxyOnly && <span className="text-[10px] text-accent-amber">proxy</span>}
              <span className="tabular-nums text-text-muted w-[72px] text-right">
                {asset.skip ? skipLabel(asset.skip) : formatPackageBytes(asset.bytes)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function skipLabel(skip: NonNullable<StudioPackagePlanSummary['assets'][number]['skip']>): string {
  if (skip === 'missing') return 'missing';
  if (skip === 'no-proxy') return 'no proxy';
  return 'relink';
}
