import { ipcMain, webContents } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { handleDecisionsDecide, handleDecisionsSettingsSet, handleDecisionsStatus } from '../decisions-handlers';
import { ensureDecisions, onDecisionsEvent } from '../../services/decisions/decision-runtime';
import { lazily } from './lazy';

/**
 * The first-use start for the handlers. A failed start is NOT thrown here: the handler's own runtime call retries the start inside its
 * try/catch and answers a typed error, so a decisions invoke never rejects (§12).
 */
async function startDecisionsQuietly(): Promise<void> {
  try {
    await ensureDecisions();
  } catch {
    // answered by the handler (typed)
  }
}

// Decisions (DECISION_MODELS_DESIGN.md §12). `lazily`: the runtime is built on the first call, never at startup (the library-search
// pattern). The push subscription creates nothing — events flow only once the runtime exists (a key change or a settings change).
export function registerDecisionsIpc(): void {
  ipcMain.handle(IPC.DECISIONS_DECIDE, lazily(startDecisionsQuietly, handleDecisionsDecide));
  ipcMain.handle(IPC.DECISIONS_STATUS, lazily(startDecisionsQuietly, handleDecisionsStatus));
  ipcMain.handle(IPC.DECISIONS_SETTINGS_SET, lazily(startDecisionsQuietly, handleDecisionsSettingsSet));

  onDecisionsEvent((event) => {
    for (const contents of webContents.getAllWebContents()) {
      if (!contents.isDestroyed()) contents.send(IPC.DECISIONS_EVENT, event);
    }
  });
}
