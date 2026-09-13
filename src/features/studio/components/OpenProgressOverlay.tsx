import { useEffect, useState } from 'react';
import { useShotModuleSnapshot } from '../hooks/useShotModuleSnapshot';
import { openProgress, shotsSettled } from '../services/open-stages';
import { markOpen } from '../services/open-timing';
import type { ShotModuleLoader } from '../services/shot-module-loader';
import { OpenProgressView } from './OpenProgressView';

/** After this long the overlay offers to get out of the way. */
const SKIP_AFTER_MS = 8000;

interface Props<C> {
  loader: ShotModuleLoader<C>;
}

/**
 * Covers the just-mounted editor until it is interactive (video-10 feedback
 * item 2): shot modules N of total, then the first Player frame — the commit
 * that carries the last module plus two animation frames. It subscribes to
 * the loader on its own, so progress ticks re-render this panel, not the
 * editor under it, and it retires for good once the open is done: a shot
 * regenerated later loads behind its placeholder tile, not behind a curtain.
 */
export function OpenProgressOverlay<C>({ loader }: Props<C>) {
  const shots = useShotModuleSnapshot(loader);
  const [framePainted, setFramePainted] = useState(false);
  const [retired, setRetired] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const allSettled = shotsSettled(shots);

  useEffect(() => {
    if (!allSettled || framePainted) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setFramePainted(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [allSettled, framePainted]);

  const progress = openProgress({ documentLoaded: true, timelineReady: true, shots, framePainted });

  useEffect(() => {
    if (!progress.done || retired) return;
    markOpen('interactive');
    setRetired(true);
  }, [progress.done, retired]);

  useEffect(() => {
    const timer = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (retired) return null;
  return (
    <div className="absolute inset-0 z-40">
      <OpenProgressView
        progress={progress}
        onSkip={
          canSkip
            ? () => {
                markOpen('skipped');
                setRetired(true);
              }
            : undefined
        }
      />
    </div>
  );
}
