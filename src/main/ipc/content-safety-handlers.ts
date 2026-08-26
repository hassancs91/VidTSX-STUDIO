import fs from 'fs/promises';
import path from 'path';
import type { ContentSafetyStatusResponse } from '../../shared/ipc/types';
import { getBlockedCounts } from '../services/content-safety/blocked-counters';
import { safetyEngine } from '../../content-safety-engine/safety-engine';
import type { SafetyModelConfig } from '../../content-safety-engine/types';
import { GENERATION_BLOCKLIST } from '../../moderation-engine/generation-blocklist';
import { getContentSafetyDir } from '../utils/paths';

export async function handleContentSafetyStatus(): Promise<ContentSafetyStatusResponse> {
  let present = false;
  let file: string | null = null;
  let sha256: string | null = null;
  try {
    const dir = getContentSafetyDir();
    const config = JSON.parse(
      await fs.readFile(path.join(dir, 'model-config.json'), 'utf-8'),
    ) as SafetyModelConfig;
    await fs.access(path.join(dir, config.file));
    present = true;
    file = config.file;
    sha256 = config.sha256;
  } catch {
    // Model missing/corrupt — the page reports it, generation stays blocked
    // (fail-closed lives in image-safety.ts, not here).
  }

  return {
    blockedCounts: getBlockedCounts(),
    promptTermCount: GENERATION_BLOCKLIST.length,
    classifier: {
      present,
      loaded: safetyEngine.isLoaded(),
      file,
      sha256,
    },
  };
}
