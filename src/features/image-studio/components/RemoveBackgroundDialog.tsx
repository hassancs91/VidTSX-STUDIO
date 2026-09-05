import { useEffect, useState } from 'react';
import { Button, Modal } from '@shared/components';
import type { AiRuntimeStatus, AiRuntimeVariant } from '../../../shared/ipc/types';
import type { RemoveBackgroundPrompt } from '../hooks/useRemoveBackground';

interface RemoveBackgroundDialogProps {
  prompt: RemoveBackgroundPrompt;
  onConfirm: (variant?: AiRuntimeVariant) => void;
  onCancel: () => void;
}

const VARIANT_LABEL: Record<AiRuntimeVariant, string> = { cu126: 'GPU', cpu: 'CPU' };

/**
 * The one dialog a user sees the first time they click "Remove background" without the
 * runtime / model (plan §4 step 5). The copy comes from the preflight; the variant
 * sizes come from the runtime status so the "smaller CPU-only runtime" link is exact.
 */
export function RemoveBackgroundDialog({ prompt, onConfirm, onCancel }: RemoveBackgroundDialogProps) {
  const { preflight } = prompt;
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
    <Modal isOpen onClose={onCancel} title="Remove background">
      <div className="p-4 max-w-[440px] space-y-3">
        <p className="text-[12px] text-text-secondary leading-relaxed">{preflight.message}</p>
        {includesRuntime && (
          <p className="text-[11px] text-text-dim leading-relaxed">
            The AI runtime is a separate Python + PyTorch download kept in the app data folder. It also powers Image → 3D and can be removed any time from the AI page (System tab).
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
