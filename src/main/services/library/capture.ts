// Web capture (ASSET_LIBRARY_DESIGN.md L6): Electron IS the browser — a
// hardened BrowserWindow loads the page and webContents.capturePage() grabs
// it. No Playwright, no downloaded browser. Output files into
// library/captures/<domain>/ as origin 'captured' with title+URL description.
//
// Hardening: sandboxed, isolated in-memory session per capture, no preload,
// every permission request denied, window.open denied. The page gets
// browser-level trust only.
//
// Two modes: hidden (default) for public pages; visible for auth-walled ones
// — the window opens for the user to log in and navigate, then the renderer
// fires LIBRARY_CAPTURE_TRIGGER ("Capture now" chip) and the shot is taken.
// No credential handling on our side.

import fs from 'fs/promises';
import { BrowserWindow, session } from 'electron';
import type { LibraryCaptureEvent } from '../../../shared/ipc/types/library';
import { logEngine } from '../../../logging/log-engine';
import { ensureLibraryRoot } from './library-paths';
import { upsertEntry } from './library-store';
import {
  captureDescription,
  domainFolder,
  reserveLibraryFile,
  slugify,
} from './library-filing';

const log = logEngine.createLogger('WebCapture');

export type CaptureViewport = 'landscape' | 'portrait' | 'desktop';

/** CSS-pixel viewport presets; rendering runs at 2× via zoom for crisp shot
 *  material (the window is created at 2× physical size). */
const VIEWPORTS: Record<CaptureViewport, { width: number; height: number }> = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const SCALE = 2;
/** Full-page cap in PHYSICAL pixels (L6) — taller pages capture the top. */
const MAX_CAPTURE_HEIGHT = 8000;
const LOAD_TIMEOUT_MS = 45_000;
const SETTLE_DELAY_MS = 1_500;
/** Visible mode waits for a human; give up eventually so an agent turn can't
 *  hang forever on a walked-away user. */
const VISIBLE_TIMEOUT_MS = 5 * 60_000;

export interface CaptureWebpageRequest {
  url: string;
  viewport?: CaptureViewport;
  /** Grow the window to the page's content height (capped) before capturing. */
  fullPage?: boolean;
  /** Show the window and wait for the user to hit Capture (auth-walled pages). */
  visible?: boolean;
  signal?: AbortSignal;
}

export interface CaptureWebpageResult {
  relPath: string;
  title: string;
  url: string;
  width: number;
  height: number;
}

type CaptureEventListener = (event: LibraryCaptureEvent) => void;

const listeners = new Set<CaptureEventListener>();
let pendingVisible: ((action: 'capture' | 'cancel') => void) | null = null;
let captureSeq = 0;

export function onCaptureEvent(listener: CaptureEventListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event: LibraryCaptureEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Listener errors must not break a capture.
    }
  }
}

/** The renderer's "Capture now"/"Cancel" chip lands here. */
export function triggerVisibleCapture(action: 'capture' | 'cancel'): boolean {
  if (!pendingVisible) return false;
  pendingVisible(action);
  return true;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function assertHttpUrl(url: string): void {
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

export async function captureWebpage(req: CaptureWebpageRequest): Promise<CaptureWebpageResult> {
  assertHttpUrl(req.url);
  if (req.visible && pendingVisible) {
    throw new Error('A visible capture is already waiting for the user — finish or cancel it first.');
  }
  const viewport = VIEWPORTS[req.viewport ?? 'landscape'];

  // Fresh in-memory session per capture: no 'persist:' prefix → nothing on
  // disk, and nothing shared with the app or previous captures.
  const ses = session.fromPartition(`webpage-capture-${++captureSeq}`);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);

  const win = new BrowserWindow({
    show: req.visible === true,
    width: viewport.width * SCALE,
    height: viewport.height * SCALE,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      session: ses,
      backgroundThrottling: false,
      zoomFactor: SCALE,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.setAudioMuted(true);

  const destroy = () => {
    if (!win.isDestroyed()) win.destroy();
  };
  const onAbort = () => {
    pendingVisible?.('cancel');
    destroy();
  };
  req.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    // --- load ------------------------------------------------------------
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Page load timed out after ${LOAD_TIMEOUT_MS / 1000} s`)),
        LOAD_TIMEOUT_MS,
      );
      win.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });
      win.webContents.once('did-fail-load', (_e, code, desc) => {
        clearTimeout(timeout);
        // In visible mode the user can retype the URL; a hidden run is dead.
        if (req.visible) resolve();
        else reject(new Error(`Page failed to load: ${desc} (${code})`));
      });
      win.on('closed', () => {
        clearTimeout(timeout);
        reject(new Error('The capture window was closed'));
      });
      void win.loadURL(req.url).catch(() => {
        /* surfaced via did-fail-load */
      });
    });

    // --- visible mode: wait for the human --------------------------------
    if (req.visible) {
      emit({ state: 'pending', url: req.url });
      const action = await new Promise<'capture' | 'cancel'>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve('cancel');
        }, VISIBLE_TIMEOUT_MS);
        pendingVisible = (a) => {
          clearTimeout(timeout);
          pendingVisible = null;
          resolve(a);
        };
        win.on('closed', () => {
          clearTimeout(timeout);
          pendingVisible = null;
          reject(new Error('The capture window was closed'));
        });
      });
      emit({ state: 'closed' });
      if (action === 'cancel') {
        throw new Error('Visible capture cancelled — nothing was saved.');
      }
    } else {
      // Settle heuristic: fonts, lazy images, first animations.
      await sleep(SETTLE_DELAY_MS);
    }
    if (win.isDestroyed()) throw new Error('The capture window was closed');

    // --- measure + optionally grow for full-page -------------------------
    const page = (await win.webContents.executeJavaScript(
      `({
        title: document.title,
        url: location.href,
        scrollHeight: Math.max(
          document.documentElement ? document.documentElement.scrollHeight : 0,
          document.body ? document.body.scrollHeight : 0
        ),
      })`,
      true,
    )) as { title: string; url: string; scrollHeight: number };

    if (req.fullPage && page.scrollHeight > viewport.height) {
      const cssHeight = Math.min(page.scrollHeight, Math.floor(MAX_CAPTURE_HEIGHT / SCALE));
      win.setSize(viewport.width * SCALE, cssHeight * SCALE);
      await sleep(500); // relayout
    }
    if (win.isDestroyed()) throw new Error('The capture window was closed');

    // --- shoot + file ----------------------------------------------------
    const image = await win.webContents.capturePage();
    const png = image.toPNG();
    if (png.length === 0) throw new Error('Capture produced an empty image');
    const size = image.getSize();

    const finalUrl = page.url || req.url;
    const root = await ensureLibraryRoot();
    const folder = domainFolder(finalUrl);
    const base = slugify(page.title || new URL(finalUrl).pathname, 'page');
    const { relPath, absPath } = await reserveLibraryFile(root, folder, base, '.png');
    await fs.writeFile(absPath, png);
    await upsertEntry(root, relPath, {
      origin: 'captured',
      description: captureDescription(page.title, finalUrl),
    });

    log.info('Webpage captured', { url: finalUrl, relPath, width: size.width, height: size.height });
    return { relPath, title: page.title, url: finalUrl, width: size.width, height: size.height };
  } finally {
    req.signal?.removeEventListener('abort', onAbort);
    if (req.visible) emit({ state: 'closed' });
    pendingVisible = null;
    destroy();
  }
}
