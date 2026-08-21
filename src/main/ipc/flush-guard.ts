// Quit-flush hardening (NEXT_FEATURES_DESIGN.md Q10): the Studio editor
// debounces saves by 600 ms, so closing the window could lose the last edits.
// The first close is deferred while the renderer flushes; it acks over
// STUDIO_FLUSH_ACK (immediately when nothing is open or dirty), and a hung
// renderer only delays the close by the timeout, never wedges it.

import { ipcMain, type BrowserWindow, type WebContents } from 'electron';
import { IPC } from '../../shared/ipc/channels';

const FLUSH_TIMEOUT_MS = 1500;

let pendingAck: (() => void) | null = null;

/** Registered with the other Studio handlers; resolves the pending close wait. */
export function registerFlushAck(): void {
  ipcMain.handle(IPC.STUDIO_FLUSH_ACK, () => {
    pendingAck?.();
    pendingAck = null;
    return { success: true };
  });
}

function requestStudioFlush(contents: WebContents): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingAck = null;
      resolve();
    }, FLUSH_TIMEOUT_MS);
    pendingAck = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      contents.send(IPC.STUDIO_FLUSH_REQUEST);
    } catch {
      clearTimeout(timer);
      pendingAck = null;
      resolve();
    }
  });
}

/** Defer the first close long enough for the renderer to flush pending edits. */
export function installQuitFlushGuard(win: BrowserWindow): void {
  let state: 'idle' | 'flushing' | 'done' = 'idle';
  win.on('close', (event) => {
    if (state === 'done') return;
    event.preventDefault();
    if (state === 'flushing') return;
    state = 'flushing';
    void requestStudioFlush(win.webContents).finally(() => {
      state = 'done';
      if (!win.isDestroyed()) win.close();
    });
  });
}
