import type { AiRuntimeStatus, AiRuntimeVariant } from '@shared/ipc/types';
import { useAiRuntime } from '../../hooks/useAiRuntime';
import { describeRuntimeInstall } from '../../services/download-labels';
import { LocalRuntimeChip, type LocalRuntimeState } from './LocalRuntimeChip';

const VARIANT_LABEL: Record<AiRuntimeVariant, string> = { cu126: 'GPU', cpu: 'CPU' };

function phaseLabel(status: AiRuntimeStatus): string {
  const variant = status.install ? VARIANT_LABEL[status.install.variant] : '';
  switch (status.install?.phase) {
    case 'preflight':
      return 'Checking this PC…';
    case 'downloading':
      return `Downloading ${variant} runtime…`;
    case 'verifying':
      return 'Verifying…';
    case 'warming-up':
      return 'Warming up (first launch)…';
    case 'finalizing':
      return 'Finishing…';
    default:
      return 'Installing…';
  }
}

function detailFor(status: AiRuntimeStatus): string | undefined {
  switch (status.state) {
    case 'installed':
      return `${VARIANT_LABEL[status.installed!.variant]} · ${status.installed!.version} · manage on Overview`;
    case 'update-available':
      return `${status.installed!.version} → ${status.targetVersion}`;
    case 'missing': {
      const rec = status.variants[status.recommendedVariant];
      return `Python + PyTorch · ${rec.sizeLabel} · variants on Overview`;
    }
    default:
      return undefined;
  }
}

function actionFor(status: AiRuntimeStatus): string | undefined {
  const rec = status.variants[status.recommendedVariant];
  switch (status.state) {
    case 'missing':
      return `Install ${VARIANT_LABEL[rec.variant]} runtime`;
    case 'update-available':
      return 'Update';
    case 'broken':
      return 'Repair';
    default:
      return undefined;
  }
}

/**
 * The downloadable AI runtime (Python + PyTorch) as the 3D strip's runtime
 * chip: state, the recommended-variant install and its progress. Variant
 * choice, Repair and Remove stay on Overview's Runtimes table (§3.1).
 */
export function AiRuntimeChip() {
  const runtime = useAiRuntime();
  const status = runtime.status;
  const state: LocalRuntimeState = runtime.loading || !status ? 'checking' : status.state;
  const recIssue = status?.state === 'missing' ? status.variants[status.recommendedVariant].issue : null;
  const postDownload =
    status?.install && status.install.phase !== 'downloading' && status.install.phase !== 'preflight';

  return (
    <LocalRuntimeChip
      id="ai-runtime"
      name="AI runtime"
      description="A separate Python + PyTorch runtime for image → 3D and background removal. Downloaded once, kept in the app data folder, removable any time."
      state={state}
      detail={status ? detailFor(status) : undefined}
      actionLabel={status ? actionFor(status) : undefined}
      actionDisabled={recIssue !== null && recIssue !== undefined}
      onAction={() => {
        if (!status) return;
        void (status.state === 'broken' ? runtime.repair() : runtime.install(status.recommendedVariant));
      }}
      progress={postDownload ? null : (runtime.download?.progress ?? null)}
      progressLabel={
        status?.state === 'installing'
          ? runtime.download && !postDownload
            ? describeRuntimeInstall(runtime.download)
            : phaseLabel(status)
          : undefined
      }
      error={recIssue?.message ?? status?.lastError ?? runtime.error}
    />
  );
}
