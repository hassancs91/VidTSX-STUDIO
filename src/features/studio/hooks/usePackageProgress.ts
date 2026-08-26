import { useEffect, useState } from 'react';
import type { StudioPackageEvent } from '@shared/ipc/types';

export interface PackageProgress {
  percent: number;
  message: string;
}

/**
 * Progress for one long package operation. Main pushes to the requesting
 * window only, so the filter is just the op: a package write is an action a
 * window started, not app state every window should react to.
 *
 * `active` gates the subscription AND resets the readout, so re-opening the
 * dialog never shows the previous run's tail.
 */
export function usePackageProgress(op: StudioPackageEvent['op'], active: boolean): PackageProgress {
  const [progress, setProgress] = useState<PackageProgress>({ percent: 0, message: '' });

  useEffect(() => {
    if (!active) {
      setProgress({ percent: 0, message: '' });
      return;
    }
    const unsubscribe = window.api.onStudioPackageEvent((event) => {
      if (event.op !== op) return;
      setProgress({ percent: event.percent, message: event.message });
    });
    return unsubscribe;
  }, [op, active]);

  return progress;
}
