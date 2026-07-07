/**
 * Minimal preload script for the isolated preview webview.
 *
 * Bridges communication between the preview page (running in a separate process)
 * and the parent renderer that hosts the <webview> element.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('previewBridge', {
  /** Send a message to the parent renderer */
  sendToParent: (msg: Record<string, unknown>): void => {
    ipcRenderer.sendToHost('preview-message', msg);
  },

  /** Listen for commands from the parent renderer */
  onCommand: (callback: (msg: Record<string, unknown>) => void): void => {
    ipcRenderer.on('preview-command', (_event, msg) => {
      callback(msg);
    });
  },
});
