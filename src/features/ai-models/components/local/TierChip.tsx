import { StatusBadge } from '@shared/components';
import { HARDWARE_TIER_LABELS, type HardwareTier } from '@shared/model-library/fit';

/**
 * "Who is this for" chip on a catalog row — the hardware class derived from the
 * same VRAM estimate the Fits badge grades, so the two never disagree. The
 * Fits badge stays the verdict for this machine.
 */
export function TierChip({ tier }: { tier?: HardwareTier }) {
  if (!tier) return null;
  return (
    <StatusBadge
      tone="neutral"
      title="Hardware class this model is sized for — the Fits badge is the verdict for this machine"
    >
      {HARDWARE_TIER_LABELS[tier]}
    </StatusBadge>
  );
}
