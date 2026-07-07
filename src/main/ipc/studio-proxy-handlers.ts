// IPC handlers for on-demand video proxy generation.
//
// The renderer owns the import list, so this handler does NOT write the proxy
// path back to the project DB — it returns the path and the renderer persists it
// on the matching import (same ownership model as the rest of the import store).

import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { logEngine } from '../../logging/log-engine';
import { IPC } from '@shared/ipc/channels';
import type {
  StudioProxyGenerateRequest,
  StudioProxyGenerateResponse,
  StudioProxyCancelRequest,
  StudioProxyCancelResponse,
  StudioProxyProgress,
  StudioProxyVerifyRequest,
  StudioProxyVerifyResponse,
} from '../../shared/ipc/types';
import { generateProxy, verifyProxies } from '../services/studio-proxy';

const log = logEngine.createLogger('StudioProxyHandlers');

// One generation per (project, import) at a time.
const inFlight = new Map<string, AbortController>();

function key(projectId: string, importId: string): string {
  return `${projectId}:${importId}`;
}

function emit<T>(wc: WebContents, channel: string, payload: T): void {
  try {
    wc.send(channel, payload);
  } catch (err) {
    log.warn('Failed to emit proxy progress', { err: String(err) });
  }
}

export async function handleStudioProxyGenerate(
  event: IpcMainInvokeEvent,
  req: StudioProxyGenerateRequest,
): Promise<StudioProxyGenerateResponse> {
  const k = key(req.projectId, req.importId);
  if (inFlight.has(k)) {
    return { success: false, error: 'Proxy already generating for this import' };
  }
  const controller = new AbortController();
  inFlight.set(k, controller);

  try {
    const { proxyPath, cached } = await generateProxy({
      projectId: req.projectId,
      importId: req.importId,
      filePath: req.filePath,
      force: req.force,
      signal: controller.signal,
      onProgress: (percent) => {
        emit<StudioProxyProgress>(event.sender, IPC.STUDIO_PROXY_PROGRESS, {
          projectId: req.projectId,
          importId: req.importId,
          percent,
        });
      },
    });
    return { success: true, proxyPath, cached };
  } catch (err) {
    if (controller.signal.aborted) return { success: false, cancelled: true };
    const message = err instanceof Error ? err.message : 'Proxy generation failed';
    log.error('proxy generation failed', err instanceof Error ? err : new Error(message));
    return { success: false, error: message };
  } finally {
    inFlight.delete(k);
  }
}

export async function handleStudioProxyCancel(
  _event: IpcMainInvokeEvent,
  req: StudioProxyCancelRequest,
): Promise<StudioProxyCancelResponse> {
  const controller = inFlight.get(key(req.projectId, req.importId));
  if (controller) controller.abort();
  return { success: true };
}

export async function handleStudioProxyVerify(
  _event: IpcMainInvokeEvent,
  req: StudioProxyVerifyRequest,
): Promise<StudioProxyVerifyResponse> {
  try {
    const present = await verifyProxies(req.projectId, req.importIds);
    return { success: true, present };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy verify failed';
    return { success: false, error: message };
  }
}
