import { ProgressBar } from '@shared/components';
import type { RenderQueueJobStatus } from '@shared/ipc/types';

interface RenderProgressProps {
  progress: number;
  status: RenderQueueJobStatus;
}

export function RenderProgress({ progress, status }: RenderProgressProps) {
  const getColor = (): 'purple' | 'green' | 'amber' | 'red' => {
    switch (status) {
      case 'rendering':
      case 'queued':
        return 'purple';
      case 'done':
        return 'green';
      case 'error':
        return 'red';
      case 'cancelled':
        return 'amber';
      default:
        return 'purple';
    }
  };

  const displayProgress = status === 'queued' ? 0 : progress;

  return (
    <div className="w-20">
      <ProgressBar value={displayProgress} color={getColor()} />
    </div>
  );
}
