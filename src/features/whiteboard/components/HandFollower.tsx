import type { HandConfig, PenPosition } from '../types';

interface Props {
  position: PenPosition | null;
  hand: HandConfig;
}

export function HandFollower({ position, hand }: Props) {
  if (!position) return null;
  const rotation = hand.rotation ?? 0;
  // Order matters: translate to target, rotate around the tip, then offset so
  // the configured tip in local coords lands exactly on the target point.
  const transform = [
    `translate(${position.x} ${position.y})`,
    `rotate(${rotation})`,
    `translate(${-hand.tipOffset.x} ${-hand.tipOffset.y})`,
  ].join(' ');
  return (
    <g
      transform={transform}
      style={{ pointerEvents: 'none' }}
      dangerouslySetInnerHTML={{ __html: hand.svg }}
    />
  );
}
