import type { IpcMainInvokeEvent } from 'electron';
import type { ModerationCheckRequest, ModerationCheckResponse } from '../../shared/ipc/types';
import { moderationEngine } from '../../moderation-engine';

export async function handleModerationCheck(
  _event: IpcMainInvokeEvent,
  data: ModerationCheckRequest,
): Promise<ModerationCheckResponse> {
  const result = moderationEngine.check(data.text);
  return {
    flagged: result.flagged,
    matches: result.matches,
    categories: result.categories,
    termCount: moderationEngine.getTermCount(),
    languages: moderationEngine.getSupportedLanguages(),
  };
}
