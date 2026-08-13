import { useState } from 'react';
import { Panel, StatusBadge } from '@shared/components';
import type { InstalledModelIpc, UnrecognizedFileIpc } from '@shared/ipc/types';
import type { ModelIssue } from '@shared/model-library/types';
import type { ModelDownloadStatus } from '../hooks/useImageLibrary';
import { DownloadCell } from './DownloadCell';
import { FamilyBadge } from './FamilyBadge';
import { FitBadge } from './FitBadge';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function usageLabel(lastUsedAt: string | null, useCount: number): string {
  if (!lastUsedAt || useCount === 0) return 'Never used';
  const date = new Date(lastUsedAt);
  const day = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
  return `Used ${useCount}× · ${day}`;
}

function missingCompanions(issues: ModelIssue[]): Extract<ModelIssue, { code: 'missing-companion' }>[] {
  return issues.filter((i): i is Extract<ModelIssue, { code: 'missing-companion' }> => i.code === 'missing-companion');
}

interface InstalledModelsListProps {
  installed: InstalledModelIpc[];
  unrecognized: UnrecognizedFileIpc[];
  activeModelId: string | null;
  /** Omit to hide the "Use" action (categories without a runner yet). */
  onUse?: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onReveal: () => void;
  /** Omit to hide the "Set up" action (categories without custom imports). */
  onSetup?: (filePath: string, fileName: string) => void;
  onOpenExternal: (url: string) => void;
  /** Active companion downloads, keyed by model id. Omit to disable one-click companion download. */
  downloads?: Record<string, ModelDownloadStatus>;
  /** One-click download of a model's missing companion files. Omit to hide the "Download files" action. */
  onDownloadCompanions?: (modelId: string) => void;
  onPauseDownload?: (modelId: string) => void;
  onResumeDownload?: (modelId: string) => void;
  onCancelDownload?: (modelId: string) => void;
}

function InstalledRow({
  model,
  active,
  download,
  onUse,
  onDelete,
  onReveal,
  onOpenExternal,
  onDownloadCompanions,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
}: {
  model: InstalledModelIpc;
  active: boolean;
  download?: ModelDownloadStatus;
  onUse?: (id: string) => void;
  onDelete: (id: string) => void;
  onReveal: () => void;
  onOpenExternal: (url: string) => void;
  onDownloadCompanions?: (id: string) => void;
  onPauseDownload?: (id: string) => void;
  onResumeDownload?: (id: string) => void;
  onCancelDownload?: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const companions = missingCompanions(model.issues);
  const downloading = download !== undefined;

  return (
    <div className="px-3 py-2 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-text-secondary truncate">{model.name}</span>
            <FamilyBadge family={model.family} />
            <FitBadge fit={model.fit} />
            {active && <StatusBadge tone="accent">Active</StatusBadge>}
          </div>
          <div className="text-[9px] text-text-dim font-mono truncate">
            {formatBytes(model.sizeBytes)} · {usageLabel(model.lastUsedAt, model.useCount)}
          </div>
        </div>

        {downloading ? (
          <DownloadCell
            status={download}
            onPause={() => onPauseDownload?.(model.id)}
            onResume={() => onResumeDownload?.(model.id)}
            onCancel={() => onCancelDownload?.(model.id)}
          />
        ) : (
          <>
            {/* Status */}
            <span className={`text-[10px] whitespace-nowrap ${model.ready ? 'text-accent-green' : 'text-accent-amber'}`}>
              {model.ready ? 'Ready' : `Needs ${companions.length} file${companions.length === 1 ? '' : 's'}`}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              {companions.length > 0 && onDownloadCompanions && (
                <button onClick={() => onDownloadCompanions(model.id)} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-light hover:bg-app-hover" title="Download the missing files so this model is ready to use">Download files</button>
              )}
              {model.ready && !active && onUse && (
                <button onClick={() => onUse(model.id)} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-light hover:bg-app-hover" title="Set as active model">Use</button>
              )}
              <button onClick={onReveal} className="px-1.5 h-[22px] rounded text-[9px] text-text-dim hover:text-text-secondary hover:bg-app-hover" title="Open models folder">Reveal</button>
              {confirming ? (
                <button onClick={() => onDelete(model.id)} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-red hover:bg-accent-red/10" title="Deletes the file from disk">Confirm delete</button>
              ) : (
                <button onClick={() => setConfirming(true)} onBlur={() => setConfirming(false)} className="px-1.5 h-[22px] rounded text-[9px] text-text-dim hover:text-accent-red hover:bg-app-hover" title="Delete file from disk">Delete</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Missing companion detail — hidden while downloading */}
      {!downloading && companions.length > 0 && (
        <div className="mt-1.5 pl-1 flex flex-col gap-0.5">
          {companions.map((c) => (
            <div key={c.kind} className="flex items-center gap-2 text-[10px] text-text-dim">
              <span className="text-accent-amber">Missing {c.kind}:</span>
              <span className="font-mono">{c.expectedNames[0]}</span>
              {c.sourceUrl && (
                <button onClick={() => onOpenExternal(c.sourceUrl!)} className="text-accent-light hover:underline">Get ↗</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InstalledModelsList({
  installed,
  unrecognized,
  activeModelId,
  onUse,
  onDelete,
  onReveal,
  onSetup,
  onOpenExternal,
  downloads,
  onDownloadCompanions,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
}: InstalledModelsListProps) {
  const isEmpty = installed.length === 0 && unrecognized.length === 0;

  return (
    <Panel>
      <div className="px-3 h-[32px] flex items-center text-[11px] font-medium text-text-muted" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        Installed
      </div>

      {isEmpty ? (
        <div className="p-6 text-center">
          <div className="text-[12px] text-text-muted">No models installed yet</div>
          <div className="text-[11px] text-text-dim mt-1">
            Download one from the list below, or use <span className="text-text-secondary">Import…</span> for
            a model file you already have.
          </div>
        </div>
      ) : (
        <>
          {installed.map((m) => (
            <InstalledRow
              key={m.id}
              model={m}
              active={activeModelId === m.id}
              download={downloads?.[m.id]}
              onUse={onUse}
              onDelete={onDelete}
              onReveal={onReveal}
              onOpenExternal={onOpenExternal}
              onDownloadCompanions={onDownloadCompanions}
              onPauseDownload={onPauseDownload}
              onResumeDownload={onResumeDownload}
              onCancelDownload={onCancelDownload}
            />
          ))}

          {unrecognized.map((u) => (
            <div key={u.filePath} className="px-3 py-2 border-b border-border last:border-b-0 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-text-secondary truncate">{u.fileName}</div>
                <div className="text-[9px] text-text-dim font-mono">{formatBytes(u.sizeBytes)} · unrecognized</div>
              </div>
              {onSetup && (
                <button
                  onClick={() => onSetup(u.filePath, u.fileName)}
                  className="px-2 h-[24px] rounded text-[10px] font-medium text-accent-light hover:bg-app-hover"
                >
                  Set up
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </Panel>
  );
}
