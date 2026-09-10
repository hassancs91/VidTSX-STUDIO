// Rendering a web page artifact to pixels for `capture_page` (W9).
//
// The library's capture window (`library/capture-window.ts`) is built for
// http(s) pages and refuses anything else, so this is its sibling for a
// LOCAL document, hardened one notch further: the page is written to a temp
// file inside the session workspace, loaded in a sandboxed, isolated,
// in-memory session, and that session's `webRequest` cancels every request
// that is not the main-frame load of that one file — so even a page that
// somehow slipped past the validator and the CSP meta it carries could reach
// nothing. Permissions denied, window.open denied, audio muted, destroyed in
// `finally`.

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { pathToFileURL } from 'url';
import { BrowserWindow, session } from 'electron';
import { WEB_PAGE_VIEWPORTS, type WebPageViewport } from '../../../shared/agents/web-page';
import { logEngine } from '../../../logging/log-engine';

const log = logEngine.createLogger('WebPageCapture');

const LOAD_TIMEOUT_MS = 30_000;
const SETTLE_DELAY_MS = 800;
/** Full-page cap in CSS pixels — taller pages capture the top. */
const MAX_FULL_PAGE_HEIGHT = 8000;

let captureSeq = 0;

export interface CaptureWebPageInput {
  /** The page, already inlined and wrapped in its CSP. */
  html: string;
  /** Folder the temp file goes in (the session workspace). */
  tempDir: string;
  viewport: WebPageViewport;
  fullPage?: boolean;
  signal?: AbortSignal;
}

export interface CaptureWebPageResult {
  png: Buffer;
  width: number;
  height: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sameUrl(a: string, b: string): boolean {
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

export async function captureWebPageHtml(input: CaptureWebPageInput): Promise<CaptureWebPageResult> {
  const size = WEB_PAGE_VIEWPORTS[input.viewport];
  await fs.mkdir(input.tempDir, { recursive: true });
  const tempFile = path.join(input.tempDir, `.capture-${randomUUID()}.html`);
  await fs.writeFile(tempFile, input.html, 'utf-8');
  const pageUrl = pathToFileURL(tempFile).href;

  // Fresh in-memory session: nothing on disk, nothing shared with the app.
  const ses = session.fromPartition(`web-page-capture-${++captureSeq}`);
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // The one allowed request is the main frame loading the temp file itself.
  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = details.resourceType === 'mainFrame' && sameUrl(details.url, pageUrl);
    if (!allowed) {
      log.warn('Blocked a request from a captured page', {
        url: details.url.slice(0, 120),
        resourceType: details.resourceType,
      });
    }
    callback({ cancel: !allowed });
  });

  const win = new BrowserWindow({
    show: false,
    width: size.width,
    height: size.height,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      session: ses,
      backgroundThrottling: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.setAudioMuted(true);

  const destroy = (): void => {
    if (!win.isDestroyed()) win.destroy();
  };
  input.signal?.addEventListener('abort', destroy, { once: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`The page did not finish loading in ${LOAD_TIMEOUT_MS / 1000} s`)),
        LOAD_TIMEOUT_MS,
      );
      win.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });
      win.webContents.once('did-fail-load', (_e, code, desc) => {
        clearTimeout(timeout);
        reject(new Error(`The page failed to load: ${desc} (${code})`));
      });
      win.on('closed', () => {
        clearTimeout(timeout);
        reject(new Error('The capture window was closed'));
      });
      void win.loadURL(pageUrl).catch(() => {
        /* surfaced via did-fail-load */
      });
    });
    await sleep(SETTLE_DELAY_MS);
    if (win.isDestroyed()) throw new Error('The capture was cancelled');

    if (input.fullPage) {
      const scrollHeight = (await win.webContents.executeJavaScript(
        `Math.max(document.documentElement ? document.documentElement.scrollHeight : 0, document.body ? document.body.scrollHeight : 0)`,
        true,
      )) as number;
      if (scrollHeight > size.height) {
        win.setContentSize(size.width, Math.min(scrollHeight, MAX_FULL_PAGE_HEIGHT));
        await sleep(300);
      }
    }
    if (win.isDestroyed()) throw new Error('The capture was cancelled');

    const image = await win.webContents.capturePage();
    const png = image.toPNG();
    if (png.length === 0) throw new Error('The capture produced an empty image');
    const dims = image.getSize();
    return { png, width: dims.width, height: dims.height };
  } finally {
    input.signal?.removeEventListener('abort', destroy);
    destroy();
    await fs.unlink(tempFile).catch(() => {});
  }
}
