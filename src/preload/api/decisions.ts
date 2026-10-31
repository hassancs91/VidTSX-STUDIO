import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  DecisionsDecideRequest,
  DecisionsDecideResponse,
  DecisionsEvent,
  DecisionsSettingsSetRequest,
  DecisionsSettingsSetResponse,
  DecisionsStatusResponse,
} from '../../shared/ipc/types';

/** The envelope rebuilt from its known fields: the key test sends ONLY the rung id (D-r19); nothing else rides along. */
function decideEnvelope(data: DecisionsDecideRequest): DecisionsDecideRequest {
  return 'test' in data ? { test: data.test } : { request: data.request };
}

export const decisionsApi = {
  // ─── Decisions — the shared decision engine (DECISION_MODELS_DESIGN.md §12); exactly these four, no key ever crosses ───
  decisionsDecide: (data: DecisionsDecideRequest): Promise<DecisionsDecideResponse> =>
    ipcRenderer.invoke(IPC.DECISIONS_DECIDE, decideEnvelope(data)),
  decisionsStatus: (): Promise<DecisionsStatusResponse> => ipcRenderer.invoke(IPC.DECISIONS_STATUS, {}),
  decisionsSettingsSet: (data: DecisionsSettingsSetRequest): Promise<DecisionsSettingsSetResponse> =>
    ipcRenderer.invoke(IPC.DECISIONS_SETTINGS_SET, data),
  onDecisionsEvent: (callback: (event: DecisionsEvent) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, data: DecisionsEvent) => callback(data);
    ipcRenderer.on(IPC.DECISIONS_EVENT, listener);
    return () => ipcRenderer.removeListener(IPC.DECISIONS_EVENT, listener);
  },
};
