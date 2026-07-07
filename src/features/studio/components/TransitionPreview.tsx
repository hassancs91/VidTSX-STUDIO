import { useEffect, useRef, useState } from 'react';
import type { StudioTransitionType } from '@shared/ipc/types';
import { transitionLayerStyle } from '../services/transitions';

// A small looping preview of a transition. Stacks an "outgoing" card (held)
// under an "incoming" card, then drives the incoming card's appearance through
// the SAME pure `transitionLayerStyle()` the real composition uses — so the
// thumbnail is a faithful preview, and any new transition type gets a correct
// preview for free.
//
// Drives `p` (presence 0→1) on its own requestAnimationFrame loop: play, hold,
// repeat. The PLAY phase matches the transition's real `durationSeconds` so the
// preview plays at true speed and updates live as the duration slider moves.
// (When we roll this across the whole picker we'll gate the loop on hover /
// share one clock for perf — see TRANSITIONS_PLAN.md.)

const DEFAULT_PLAY_MS = 1000;
const HOLD_MS = 500;

export function TransitionPreview({
  type,
  durationSeconds,
  dir = 'in',
  className,
}: {
  type: StudioTransitionType;
  // Play-phase length. Defaults to ~1s when omitted. Read through a ref so a
  // duration change retimes the loop smoothly without restarting it.
  durationSeconds?: number;
  // 'in' previews the clip entering (presence 0→1); 'out' previews it leaving
  // (presence 1→0), revealing the card beneath — a faithful exit preview.
  dir?: 'in' | 'out';
  className?: string;
}) {
  const [p, setP] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const playMsRef = useRef(DEFAULT_PLAY_MS);
  playMsRef.current = durationSeconds && durationSeconds > 0 ? durationSeconds * 1000 : DEFAULT_PLAY_MS;
  const dirRef = useRef(dir);
  dirRef.current = dir;

  useEffect(() => {
    let mounted = true;
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const playMs = playMsRef.current;
      const elapsed = (now - startRef.current) % (playMs + HOLD_MS);
      const raw = elapsed < playMs ? elapsed / playMs : 1;
      const eased = 1 - Math.pow(1 - raw, 3); // ease-out cubic
      // 'out' plays presence in reverse (present → gone) so it reads as the clip
      // leaving rather than arriving.
      if (mounted) setP(dirRef.current === 'out' ? 1 - eased : eased);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const incomingStyle = transitionLayerStyle(type, p, dir);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        overflow: 'hidden',
        borderRadius: 6,
        border: '0.5px solid var(--color-border)',
        backgroundColor: '#000',
      }}
    >
      {/* Outgoing card (held underneath) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #3a3a52 0%, #23233a 100%)',
          color: 'rgba(255,255,255,0.65)',
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        1
      </div>
      {/* Incoming card (animated via the shared transition style) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, var(--color-accent) 0%, #8b5cf6 100%)',
          color: 'white',
          fontSize: 28,
          fontWeight: 700,
          ...incomingStyle,
        }}
      >
        2
      </div>
    </div>
  );
}
