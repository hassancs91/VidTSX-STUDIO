import { Clapperboard, Import, Package, TriangleAlert, Wand2 } from 'lucide-react';
import { describeImportReport } from '@shared/studio/shot-import';
import type { useShotImport } from '../hooks/useShotImport';

/**
 * Import panel (D14). Two thin callers over one accept path: a Creator project
 * row (the service gets that project's latest version file) and the generic
 * file picker (main opens the OS dialog). A rejected file shows the pointed
 * error, and — when the ONLY problem is the allowlist gap — "Convert for
 * Studio", which re-imports the same source through one conform pass.
 */
export function ImportShotPanel({ shotImport }: { shotImport: ReturnType<typeof useShotImport> }) {
  const { creatorProjects, listing, busy, failure, lastReport } = shotImport;

  return (
    <div
      className="flex flex-col gap-2 p-2 rounded-[6px] bg-app-surface"
      style={{ border: '0.5px solid var(--color-border)' }}
      data-import-shot-panel
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted">From the TSX Creator</span>
        <button
          onClick={() => void shotImport.importFromFile()}
          disabled={busy}
          data-import-shot-file
          title="Pick any .tsx composition on this machine"
          className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-text-muted hover:bg-app-hover hover:text-text-secondary transition-colors disabled:opacity-50"
        >
          <Import size={11} strokeWidth={1.5} />
          Import .tsx file…
        </button>
      </div>

      {listing ? (
        <div className="text-[10px] text-text-dim px-1">Scanning Creator projects…</div>
      ) : creatorProjects && creatorProjects.length > 0 ? (
        <div className="flex flex-col gap-1 max-h-[168px] overflow-y-auto">
          {creatorProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => void shotImport.importFromCreator(project)}
              disabled={busy}
              data-creator-project={project.id}
              title={`${project.filePath}\n\nImport v${project.latestVersion} as a shot`}
              className="flex items-center gap-2 px-1.5 py-[5px] rounded-[5px] bg-app-base hover:bg-app-hover transition-colors text-left disabled:opacity-50"
              style={{ border: '0.5px solid var(--color-border)' }}
            >
              <Clapperboard size={12} strokeWidth={1.5} className="text-text-ghost shrink-0" />
              <span className="flex-1 min-w-0 text-[10px] text-text-primary truncate">{project.name}</span>
              <span className="text-[9px] text-text-dim shrink-0">
                v{project.latestVersion} · {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-[10px] text-text-dim px-1">
          No Creator projects yet — build one on the Motion screen, or import any .tsx file.
        </div>
      )}

      {lastReport && !failure && (
        <div
          className="flex items-start gap-1.5 p-1.5 rounded-[5px] bg-app-base"
          style={{ border: '0.5px solid var(--color-border)' }}
          data-import-shot-report
        >
          <Package size={11} strokeWidth={1.75} className="text-accent-light shrink-0 mt-px" />
          <span className="text-[10px] text-text-secondary leading-snug">{describeImportReport(lastReport)}</span>
        </div>
      )}

      {failure && (
        <div
          className="flex flex-col gap-1.5 p-1.5 rounded-[5px]"
          style={{
            border: '0.5px solid var(--color-accent-red, #e5484d)',
            background: 'rgba(240, 149, 149, 0.06)',
          }}
          data-import-shot-error
        >
          <div className="flex items-start gap-1.5">
            <TriangleAlert size={11} strokeWidth={1.75} className="text-accent-red shrink-0 mt-px" />
            <span className="text-[10px] text-text-secondary leading-snug">{failure.message}</span>
          </div>
          {failure.conformable && (
            <div className="flex justify-end">
              <button
                onClick={() => void shotImport.convertForStudio()}
                disabled={busy}
                data-convert-for-studio
                title="One AI pass inlines the unsupported imports; the untouched original is kept as original.tsx"
                className="flex items-center gap-1 px-1.5 h-[20px] rounded-[5px] text-[10px] text-accent-light hover:bg-app-hover transition-colors disabled:opacity-50"
                style={{ border: '0.5px solid var(--color-border-hover)' }}
              >
                <Wand2 size={11} strokeWidth={1.5} />
                Convert for Studio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
