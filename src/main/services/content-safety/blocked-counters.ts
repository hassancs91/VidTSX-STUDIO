import { getValue, setValue } from '../settings-db';
import type { ContentSafetyGate } from '../../../shared/content-safety';

/**
 * Local blocked-event counters for the Content Safety page. Settings-KV,
 * NOT the ai-usage tables (Rev 1 decision 7); nothing ever leaves the
 * machine — the dashboard reads these over CONTENT_SAFETY_STATUS.
 */

const KEY = 'contentSafetyBlockedCounts';

export interface BlockedCounts {
  prompt: number;
  image: number;
}

export function getBlockedCounts(): BlockedCounts {
  const raw = getValue<Partial<BlockedCounts>>(KEY) ?? {};
  return {
    prompt: typeof raw.prompt === 'number' && raw.prompt >= 0 ? raw.prompt : 0,
    image: typeof raw.image === 'number' && raw.image >= 0 ? raw.image : 0,
  };
}

export function recordBlocked(gate: ContentSafetyGate): void {
  const counts = getBlockedCounts();
  counts[gate] += 1;
  setValue(KEY, counts);
}
