// Importing a `.vidtsxpack` or `.vidtsxtransition` (TRANSITION_PACKS_DESIGN.md
// "Import — two extensions"). The package is READ first (inspect: container,
// manifest, the import gate on every component), so the user decides on what
// it holds. A tampered package never reaches this screen — it is refused while
// being read. Installing is the act of trust, so the dialog says what that
// means. The same version is left alone; an older one says so before it
// replaces a newer one.

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useToast } from '@renderer/contexts/ToastContext';
import type { InspectedTransitionPackage } from '@shared/ipc/types';
import { announceTransitionsChanged } from '../hooks/useTransitionImport';

interface Props {
  filePath: string;
  onClose: () => void;
}

const AMBER_BOX = { backgroundColor: 'rgba(239,159,39,0.12)' };

function actionLine(pkg: InspectedTransitionPackage): string | null {
  const where = pkg.format === 'pack' ? `the "${pkg.packId}" pack` : 'Imported';
  switch (pkg.action) {
    case 'new':
      return pkg.format === 'pack' ? `Installs as a new pack, "${pkg.packId}".` : 'Installs into Imported.';
    case 'update':
      return `Updates ${where} from ${pkg.installedVersion} to ${pkg.version}.`;
    case 'same':
      return `Version ${pkg.version} is already installed.`;
    case 'downgrade':
      return null; // its own warning box
  }
}

export function ImportTransitionsDialog({ filePath, onClose }: Props) {
  const { showToast } = useToast();
  const [pkg, setPkg] = useState<InspectedTransitionPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let disposed = false;
    const inspect = async (): Promise<void> => {
      const result = await window.api.studioTransitionPackageInspect({ filePath });
      if (disposed) return;
      if (result.success && result.package) setPkg(result.package);
      else setError(result.error ?? 'That file is not a transition package this app can read.');
    };
    void inspect();
    return () => {
      disposed = true;
    };
  }, [filePath]);

  const install = async (): Promise<void> => {
    if (!pkg) return;
    setInstalling(true);
    const result = await window.api.studioTransitionPackageInstall({
      filePath,
      confirmDowngrade: pkg.action === 'downgrade',
    });
    setInstalling(false);
    if (!result.success) {
      setError(result.error ?? 'The install failed.');
      return;
    }
    if (result.unchanged) {
      showToast(`${pkg.name} ${pkg.version} is already installed`, 'info');
    } else if (result.installed) {
      const count = result.installed.kinds.length;
      showToast(`Installed ${count} transition${count === 1 ? '' : 's'} from ${pkg.name}`, 'success');
      announceTransitionsChanged();
    }
    onClose();
  };

  const installable = pkg ? pkg.items.filter((item) => !item.refused).length : 0;
  const line = pkg ? actionLine(pkg) : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-[8px] bg-app-surface"
        style={{ border: '0.5px solid var(--color-border)' }}
        data-import-transitions-dialog
      >
        <div className="flex items-center justify-between px-3 h-[40px]" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="text-[13px] font-medium text-text-secondary">Import transitions</span>
          <button onClick={onClose} title="Close" className="text-text-muted hover:text-text-primary">
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {error ? (
            <div className="flex items-start gap-2 text-[11px] text-accent-red leading-snug whitespace-pre-wrap" data-import-error>
              <AlertTriangle size={12} strokeWidth={1.75} className="shrink-0 mt-[2px]" />
              <span>{error}</span>
            </div>
          ) : !pkg ? (
            <div className="text-[11px] text-text-dim">Reading the package…</div>
          ) : (
            <>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-text-primary">{pkg.name}</span>
                  <span className="text-[10px] text-text-dim">{pkg.version}</span>
                </div>
                <div className="text-[10px] text-text-dim">
                  {[pkg.author ? `by ${pkg.author}` : null, pkg.license].filter(Boolean).join(' · ') || 'No author given'}
                </div>
              </div>
              {pkg.description ? <div className="text-[11px] text-text-secondary leading-snug">{pkg.description}</div> : null}

              <div className="rounded-[6px] px-2 py-1.5 text-[10px] leading-snug text-accent-amber" style={AMBER_BOX}>
                Transitions are code that runs inside the editor. Install only files from people you trust.
              </div>

              <div>
                <div className="text-[11px] font-medium text-text-muted mb-1">
                  {pkg.format === 'pack' ? `${pkg.items.length} transition${pkg.items.length === 1 ? '' : 's'}` : 'Transition'}
                </div>
                {pkg.items.map((item) => (
                  <div key={item.kind} className="py-0.5" data-import-item={item.kind}>
                    <div className="flex items-baseline gap-1.5 text-[11px]">
                      <span className={item.refused ? 'text-text-dim line-through' : 'text-text-secondary'}>{item.name}</span>
                      <span className="text-[10px] text-text-dim">
                        {item.durationSeconds} s{item.sceneCopies === 'multi' ? ' · heavy' : ''}
                      </span>
                    </div>
                    {item.refused ? (
                      <div className="text-[10px] text-accent-red leading-snug" data-import-refused>
                        Not installed: {item.refused}
                      </div>
                    ) : null}
                  </div>
                ))}
                {pkg.problems.map((problem) => (
                  <div key={problem} className="text-[10px] text-text-dim leading-snug">
                    {problem}
                  </div>
                ))}
              </div>

              {line ? <div className="text-[10px] text-text-dim">{line}</div> : null}
              {pkg.action === 'downgrade' ? (
                <div className="rounded-[6px] px-2 py-1.5 text-[10px] leading-snug text-accent-amber" style={AMBER_BOX}>
                  Version {pkg.installedVersion} is installed. Installing {pkg.version} replaces it with an older one.
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-3 py-2" style={{ borderTop: '0.5px solid var(--color-border)' }}>
          <button
            onClick={onClose}
            className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-secondary hover:bg-app-hover"
            style={{ border: '0.5px solid var(--color-border-hover)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => void install()}
            disabled={!pkg || installing || Boolean(error) || pkg.action === 'same' || installable === 0}
            className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] text-white disabled:opacity-40"
            data-import-install
          >
            {installing
              ? 'Installing…'
              : pkg?.action === 'same'
                ? 'Installed'
                : pkg?.action === 'downgrade'
                  ? 'Install the older version'
                  : pkg?.action === 'update'
                    ? 'Update'
                    : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}
