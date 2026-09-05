import { useEffect, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import type { StudioExportEngineStatus } from '@shared/ipc/types';
import { DEFAULT_EXPORT_ENGINE_ID, EXPORT_ENGINES, type ExportEngineId } from '@shared/studio/export-engines';

/** localStorage key that reveals the dev verification controls (D5). */
export const EXPORT_VERIFY_FLAG = 'vidtsx:export-verify';

export interface ExportChoice {
  engineId: ExportEngineId;
  verifyAgainstEngine?: ExportEngineId;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Non-null for "Export range" — shown so the user knows what they commit. */
  rangeLabel: string | null;
  /** Resolves when the job is queued (or failed with a toast); the dialog closes on true. */
  onExport: (choice: ExportChoice) => Promise<boolean>;
}

/**
 * Studio Export dialog (docs/export-engines-plan.md D2/D3): an engine picker
 * that starts on the Settings › Rendering default and shows each engine's
 * trade-off, never its name. With one engine registered the picker still
 * exists. The verification controls (D5) only appear in dev builds when the
 * `vidtsx:export-verify` localStorage flag is set.
 */
export function ExportDialog({ isOpen, onClose, rangeLabel, onExport }: Props) {
  const [engines, setEngines] = useState<StudioExportEngineStatus[]>([]);
  const [selected, setSelected] = useState<ExportEngineId>(DEFAULT_EXPORT_ENGINE_ID);
  const [verifyAvailable, setVerifyAvailable] = useState(false);
  const [verify, setVerify] = useState(false);
  const [verifyAgainst, setVerifyAgainst] = useState<ExportEngineId>(DEFAULT_EXPORT_ENGINE_ID);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    let disposed = false;
    setLoading(true);
    setBusy(false);
    setVerify(false);
    void window.api.studioExportEnginesList().then((res) => {
      if (disposed) return;
      setLoading(false);
      setEngines(res.engines);
      const usable = res.engines.find((e) => e.id === res.defaultId && e.available) ?? res.engines.find((e) => e.available);
      setSelected(usable?.id ?? res.defaultId);
      setVerifyAgainst(res.defaultId);
      setVerifyAvailable(res.verifyAvailable && readVerifyFlag());
    });
    return () => {
      disposed = true;
    };
  }, [isOpen]);

  const handleExport = async () => {
    setBusy(true);
    const ok = await onExport({
      engineId: selected,
      verifyAgainstEngine: verifyAvailable && verify ? verifyAgainst : undefined,
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={rangeLabel ? 'Export range' : 'Export'}>
      <div className="w-[440px] flex flex-col gap-2" data-export-dialog>
        {rangeLabel && (
          <p className="text-[11px] text-text-dim leading-snug">Exports {rangeLabel} of the timeline.</p>
        )}
        <div className="text-[11px] text-text-muted">How to render</div>
        {loading && <div className="text-[11px] text-text-dim">Loading…</div>}
        {engines.map((status) => {
          const def = EXPORT_ENGINES.find((e) => e.id === status.id);
          if (!def) return null;
          const active = selected === status.id;
          return (
            <label
              key={status.id}
              className={`flex items-start gap-2 p-2 rounded-[6px] cursor-pointer ${
                status.available ? 'bg-app-base hover:bg-app-hover' : 'bg-app-base opacity-60 cursor-not-allowed'
              }`}
              style={{ border: `0.5px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}` }}
              data-export-engine={status.id}
            >
              <input
                type="radio"
                name="export-engine"
                className="mt-0.5"
                checked={active}
                disabled={!status.available || busy}
                onChange={() => setSelected(status.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-primary">{def.label}</div>
                <div className="text-[10px] text-text-dim">{def.description}</div>
                {!status.available && status.unavailableReason && (
                  <div className="text-[10px] text-text-ghost mt-0.5">{status.unavailableReason}</div>
                )}
              </div>
            </label>
          );
        })}

        {verifyAvailable && (
          <div className="flex flex-col gap-1 p-2 rounded-[6px] bg-app-base" style={{ border: '0.5px dashed var(--color-border)' }} data-export-verify>
            <label className="flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
              <input type="checkbox" checked={verify} disabled={busy} onChange={(e) => setVerify(e.target.checked)} />
              Verify (dev): export again through another engine and report the pixel diff + audio offset
            </label>
            {verify && (
              <select
                className="bg-app-base border border-border rounded px-2 py-1 text-[11px] text-text-secondary outline-none"
                value={verifyAgainst}
                disabled={busy}
                onChange={(e) => setVerifyAgainst(e.target.value as ExportEngineId)}
              >
                {engines.map((s) => (
                  <option key={s.id} value={s.id}>
                    {EXPORT_ENGINES.find((e) => e.id === s.id)?.label ?? s.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-1">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => void handleExport()} disabled={busy || loading} data-export-confirm>
            {busy ? 'Preparing…' : rangeLabel ? 'Export range' : 'Export'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function readVerifyFlag(): boolean {
  try {
    return window.localStorage.getItem(EXPORT_VERIFY_FLAG) === '1';
  } catch {
    return false;
  }
}
