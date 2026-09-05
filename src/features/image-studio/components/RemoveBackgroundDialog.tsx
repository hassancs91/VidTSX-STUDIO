import { AiRuntimeInstallDialog } from '@renderer/components/AiRuntimeInstallDialog';
import type { AiRuntimeVariant } from '../../../shared/ipc/types';
import type { RemoveBackgroundPrompt } from '../hooks/useRemoveBackground';

interface RemoveBackgroundDialogProps {
  prompt: RemoveBackgroundPrompt;
  onConfirm: (variant?: AiRuntimeVariant) => void;
  onCancel: () => void;
}

/**
 * The one dialog a user sees the first time they click "Remove background" without the
 * runtime / model (plan §4 step 5) — the shared runtime-install dialog with this
 * feature's title.
 */
export function RemoveBackgroundDialog({ prompt, onConfirm, onCancel }: RemoveBackgroundDialogProps) {
  return <AiRuntimeInstallDialog title="Remove background" preflight={prompt.preflight} onConfirm={onConfirm} onCancel={onCancel} />;
}
