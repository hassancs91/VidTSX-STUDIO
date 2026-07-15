import { useState } from 'react';
import type { InstalledModelIpc, UnrecognizedFileIpc } from '@shared/ipc/types';
import type { ModelIssue } from '@shared/model-library/types';

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

function familyLabel(family: string): string {
  const map: Record<string, string> = { sd15: 'SD 1.5', sdxl: 'SDXL', sd3: 'SD 3.x', flux1: 'FLUX.1', flux2: 'FLUX.2' };
  return map[family] ?? family.toUpperCase();
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

function FamilyBadge({ family }: { family: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">
      {familyLabel(family)}
    </span>
  );
}

interface InstalledModelsListProps {
  installed: InstalledModelIpc[];
  unrecognized: UnrecognizedFileIpc[];
  activeModelId: string | null;
  onUse: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onReveal: () => void;
  onSetup: (filePath: string, fileName: string) => void;
  onOpenExternal: (url: string) => void;
}

function InstalledRow({
  model,
  active,
  onUse,
  onDelete,
  onReveal,
  onOpenExternal,
}: {
  model: InstalledModelIpc;
  active: boolean;
  onUse: (id: string) => void;
  onDelete: (id: string) => void;
  onReveal: () => void;
  onOpenExternal: (url: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const companions = missingCompanions(model.issues);

  return (
    <div className="px-3 py-2 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-text-secondary truncate">{model.name}</span>
            <FamilyBadge family={model.family} />
            {active && (
              <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-medium bg-accent/15 text-accent-light">ACTIVE</span>
            )}
          </div>
          <div className="text-[9px] text-text-dim font-mono truncate">
            {formatBytes(model.sizeBytes)} · {usageLabel(model.lastUsedAt, model.useCount)}
          </div>
        </div>

        {/* Status */}
        <span className={`text-[10px] whitespace-nowrap ${model.ready ? 'text-accent-green' : 'text-accent-amber'}`}>
          {model.ready ? 'Ready' : `Needs ${companions.length} file${companions.length === 1 ? '' : 's'}`}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          {model.ready && !active && (
            <button onClick={() => onUse(model.id)} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-light hover:bg-app-hover" title="Set as active model">Use</button>
          )}
          <button onClick={onReveal} className="px-1.5 h-[22px] rounded text-[9px] text-text-dim hover:text-text-secondary hover:bg-app-hover" title="Open models folder">Reveal</button>
          {confirming ? (
            <button onClick={() => onDelete(model.id)} className="px-1.5 h-[22px] rounded text-[9px] font-medium text-accent-red hover:bg-accent-red/10" title="Deletes the file from disk">Confirm delete</button>
          ) : (
            <button onClick={() => setConfirming(true)} onBlur={() => setConfirming(false)} className="px-1.5 h-[22px] rounded text-[9px] text-text-dim hover:text-accent-red hover:bg-app-hover" title="Delete file from disk">Delete</button>
          )}
        </div>
      </div>

      {/* Missing companion detail */}
      {companions.length > 0 && (
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
}: InstalledModelsListProps) {
  const isEmpty = installed.length === 0 && unrecognized.length === 0;

  return (
    <div className="bg-app-surface rounded-lg border border-border overflow-hidden">
      <div className="px-3 h-[32px] flex items-center text-[10px] font-medium text-text-dim uppercase tracking-wider" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        Your models
      </div>

      {isEmpty ? (
        <div className="p-4 text-[12px] text-text-muted text-center">
          No models in this folder yet. Download one below, or use <span className="text-text-secondary">Import</span>.
        </div>
      ) : (
        <>
          {installed.map((m) => (
            <InstalledRow
              key={m.id}
              model={m}
              active={activeModelId === m.id}
              onUse={onUse}
              onDelete={onDelete}
              onReveal={onReveal}
              onOpenExternal={onOpenExternal}
            />
          ))}

          {unrecognized.map((u) => (
            <div key={u.filePath} className="px-3 py-2 border-b border-border last:border-b-0 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[12px] text-text-secondary truncate">{u.fileName}</div>
                <div className="text-[9px] text-text-dim font-mono">{formatBytes(u.sizeBytes)} · unrecognized</div>
              </div>
              <button
                onClick={() => onSetup(u.filePath, u.fileName)}
                className="px-2 h-[24px] rounded text-[10px] font-medium text-accent-light hover:bg-app-hover"
              >
                Set up
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
