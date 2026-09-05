import { useEffect, useState } from 'react';
import { Button, Modal } from '@shared/components';
import type { AiRuntimeStatus, AiRuntimeVariant, PythonModelPreflightIpc } from '@shared/ipc/types';

interface AiRuntimeInstallDialogProps {
  title: string;
  preflight: Extract<PythonModelPreflightIpc, { ready: false }>;
  /** One extra sentence about what the feature does with the runtime (optional). */
  note?: string;
  onConfirm: (variant?: AiRuntimeVariant) => void;
  onCancel: () => void;
}

const VARIANT_LABEL: Record<AiRuntimeVariant, string> = { cu126: 'GPU', cpu: 'CPU' };

/**
 * The one dialog a feature shows the first time it needs the AI runtime / a model
 * (docs/ai-runtime-implementation-plan.md §4 step 5, §7b). The copy comes from the
 * preflight; the runtime status supplies the exact size for the "smaller CPU-only
 * runtime" link. Shared by Image Studio (Remove background) and 3D Studio.
 */
export function AiRuntimeInstallDialog({ title, preflight, note, onConfirm, onCancel }: AiRuntimeInstallDialogProps) {
  const action = preflight.action;
  const includesRuntime = action !== undefined && action.kind !== 'download-model';
  const [runtime, setRuntime] = useState<AiRuntimeStatus | null>(null);

  useEffect(() => {
    if (!includesRuntime) return;
    let alive = true;
    void window.api.aiRuntimeStatus().then((res) => {
      if (alive && res.success && res.status) setRuntime(res.status);
    });
    return () => {
      alive = false;
    };
  }, [includesRuntime]);

  const recommended = action?.variant ?? runtime?.recommendedVariant;
  const other = runtime && recommended ? runtime.variants[recommended === 'cu126' ? 'cpu' : 'cu126'] : null;

  return (
    <Modal isOpen onClose={onCancel} title={title}>
      <div className="p-4 max-w-[440px] space-y-3" data-testid="ai-runtime-install-dialog">
        <p className="text-[12px] text-text-secondary leading-relaxed">{preflight.message}</p>
        {includesRuntime && (
          <p className="text-[11px] text-text-dim leading-relaxed">
            The AI runtime is a separate Python + PyTorch download kept in the app data folder. It powers background removal and Image → 3D and can be removed any time from the AI page (System tab).
            {note ? ` ${note}` : ''}
            {recommended && runtime ? ` Recommended here: the ${VARIANT_LABEL[recommended]} runtime — ${runtime.recommendationReason}` : ''}
          </p>
        )}
        {!action && (
          <p className="text-[11px] text-accent-amber">This cannot be fixed from here. Open the AI page (System tab) for details.</p>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel}>Not now</Button>
          {action && (
            <Button variant="primary" onClick={() => onConfirm(action.variant)}>
              {action.label}
            </Button>
          )}
        </div>
        {includesRuntime && other && other.variant === 'cpu' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => onConfirm('cpu')}
              disabled={other.issue !== null}
              title={other.issue?.message ?? 'Smaller download, runs on any PC'}
              className="text-[10px] text-text-muted hover:text-text-secondary underline-offset-2 hover:underline disabled:opacity-50"
            >
              Use the smaller CPU-only runtime ({other.sizeLabel}) instead
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
