// The hardened capture BrowserWindow, shared by single-shot capture
// (capture.ts, L6) and scripted capture (capture-script.ts, L6b). One
// definition so a hardening fix can never land in one capture path only:
// sandboxed, isolated in-memory session per window, no preload, every
// permission request denied, window.open denied, audio muted. The page gets
// browser-level trust and nothing else.

import { BrowserWindow, session } from 'electron';

export type CaptureViewport = 'landscape' | 'portrait' | 'desktop';

/** CSS-pixel viewport presets; rendering runs at 2× via zoom for crisp shot
 *  material (the window is created at 2× physical size). */
export const VIEWPORTS: Record<CaptureViewport, { width: number; height: number }> = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

export const CAPTURE_SCALE = 2;
/** Full-page cap in PHYSICAL pixels (L6) — taller pages capture the top. */
export const MAX_CAPTURE_HEIGHT = 8000;

let captureSeq = 0;

export function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a valid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Only http(s) pages can be captured (got ${parsed.protocol}//).`);
  }
}

export function createCaptureWindow(viewport: CaptureViewport, show: boolean): BrowserWindow {
  const size = VIEWPORTS[viewport];

  // Fresh in-memory session per capture: no 'persist:' prefix → nothing on
  // disk, and nothing shared with the app or previous captures.
  const ses = session.fromPartition(`webpage-capture-${++captureSeq}`);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  const win = new BrowserWindow({
    show,
    width: size.width * CAPTURE_SCALE,
    height: size.height * CAPTURE_SCALE,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      session: ses,
      backgroundThrottling: false,
      zoomFactor: CAPTURE_SCALE,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.setAudioMuted(true);
  return win;
}
