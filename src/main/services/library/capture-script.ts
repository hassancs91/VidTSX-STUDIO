// Scripted capture (ASSET_LIBRARY_DESIGN.md L6b / SHOT_QUALITY_DESIGN Q4b):
// drive the hardened hidden capture window through typed steps — navigate,
// wait, scroll, type, click — and shoot N stills that file into the library
// like capture_webpage output. Real input goes through sendInputEvent;
// executeJavaScript is used for MEASUREMENT ONLY (rects, scroll metrics,
// title/url) — nothing the agent writes ever executes as page code
// (selectors are JSON-encoded into querySelector, text becomes char events).
//
// Failure semantics (S3): a failing step stops the script; stills already on
// disk stay (they are real assets) and the result names the failed step.
// Hidden-window only (S4) — auth walls stay on the manual visible capture.

import fs from 'fs/promises';
import type { BrowserWindow } from 'electron';
import { logEngine } from '../../../logging/log-engine';
import { ensureLibraryRoot } from './library-paths';
import { upsertEntry } from './library-store';
import { domainFolder, reserveLibraryFile, slugify } from './library-filing';
import { checkImageBuffer } from '../content-safety/image-safety';
import {
  assertHttpUrl,
  createCaptureWindow,
  CAPTURE_SCALE,
  MAX_CAPTURE_HEIGHT,
  VIEWPORTS,
  type CaptureViewport,
} from './capture-window';

const log = logEngine.createLogger('ScriptedCapture');

export const SCRIPT_MAX_STEPS = 30;
export const SCRIPT_MAX_CAPTURES = 10;
/** Per-step budget; `wait.ms` may use up to its own (capped) value. */
export const STEP_TIMEOUT_MS = 10_000;
export const SCRIPT_TIMEOUT_MS = 120_000;
const NAV_TIMEOUT_MS = 45_000;
const SETTLE_MS = 400;
const NAV_SETTLE_MS = 1_500;

export type CaptureScriptStep =
  | { op: 'navigate'; url: string }
  | { op: 'wait'; ms?: number; selector?: string }
  | { op: 'scroll'; to: number | 'bottom' | string }
  | { op: 'type'; selector: string; text: string }
  | { op: 'click'; selector: string }
  | { op: 'capture'; label: string; fullPage?: boolean };

export interface ScriptedCaptureRequest {
  url: string;
  viewport?: CaptureViewport;
  steps: CaptureScriptStep[];
  signal?: AbortSignal;
}

export interface ScriptedStill {
  relPath: string;
  label: string;
  width: number;
  height: number;
}

export interface ScriptedCaptureResult {
  stills: ScriptedStill[];
  failedStep?: { index: number; op: string; error: string };
}

/** Pure validation (S1 caps) — returns an error message or null. */
export function validateCaptureScript(steps: CaptureScriptStep[]): string | null {
  if (steps.length === 0) return 'The script has no steps.';
  if (steps.length > SCRIPT_MAX_STEPS) {
    return `Too many steps (${steps.length}); the cap is ${SCRIPT_MAX_STEPS}.`;
  }
  const captures = steps.filter((s) => s.op === 'capture');
  if (captures.length === 0) return 'The script never captures — add at least one capture step.';
  if (captures.length > SCRIPT_MAX_CAPTURES) {
    return `Too many captures (${captures.length}); the cap is ${SCRIPT_MAX_CAPTURES}.`;
  }
  for (const [i, step] of steps.entries()) {
    if (step.op === 'capture' && step.label.trim().length === 0) {
      return `Step ${i + 1}: capture needs a non-empty label (it becomes the searchable description).`;
    }
    if (step.op === 'navigate') {
      try {
        assertHttpUrl(step.url);
      } catch (err) {
        return `Step ${i + 1}: ${err instanceof Error ? err.message : String(err)}`;
      }
    }
  }
  return null;
}

/** Pure description for a scripted still: label first — it is the signal. */
export function scriptedStillDescription(label: string, title: string, url: string): string {
  const t = title.trim();
  return `${label.trim()}${t.length > 0 ? ` — ${t}` : ''} (${url})`;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms / 1000} s`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Measurement-only page query: the selector is JSON-encoded data, never code. */
async function measureSelector(
  win: BrowserWindow,
  selector: string,
): Promise<{ found: boolean; visible: boolean; x: number; y: number }> {
  return (await win.webContents.executeJavaScript(
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { found: false, visible: false, x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 &&
        r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      return { found: true, visible, x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`,
    true,
  )) as { found: boolean; visible: boolean; x: number; y: number };
}

async function loadUrl(win: BrowserWindow, url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Page load timed out after ${NAV_TIMEOUT_MS / 1000} s`)),
      NAV_TIMEOUT_MS,
    );
    win.webContents.once('did-finish-load', () => {
      clearTimeout(timeout);
      resolve();
    });
    win.webContents.once('did-fail-load', (_e, code, desc) => {
      clearTimeout(timeout);
      reject(new Error(`Page failed to load: ${desc} (${code})`));
    });
    win.once('closed', () => {
      clearTimeout(timeout);
      reject(new Error('The capture window was closed'));
    });
    void win.loadURL(url).catch(() => {
      /* surfaced via did-fail-load */
    });
  });
  await sleep(NAV_SETTLE_MS);
}

/** Real mouse input at a CSS-pixel point (the window renders at 2× zoom, so
 *  input coordinates are CSS × scale). A move first, for hover states. */
async function clickAt(win: BrowserWindow, cssX: number, cssY: number): Promise<void> {
  const x = Math.round(cssX * CAPTURE_SCALE);
  const y = Math.round(cssY * CAPTURE_SCALE);
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
  await sleep(50);
  win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
  await sleep(30);
  win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
}

async function requireVisible(win: BrowserWindow, selector: string, what: string) {
  const m = await measureSelector(win, selector);
  if (!m.found) throw new Error(`${what}: no element matches selector "${selector}"`);
  if (!m.visible) throw new Error(`${what}: "${selector}" is not visible in the viewport (scroll to it first?)`);
  return m;
}

let scriptedActive = false;

export async function captureScripted(req: ScriptedCaptureRequest): Promise<ScriptedCaptureResult> {
  assertHttpUrl(req.url);
  const invalid = validateCaptureScript(req.steps);
  if (invalid) throw new Error(invalid);
  if (scriptedActive) {
    throw new Error('A scripted capture is already running — one at a time.');
  }
  scriptedActive = true;

  const viewportName: CaptureViewport = req.viewport ?? 'landscape';
  const viewport = VIEWPORTS[viewportName];
  const win = createCaptureWindow(viewportName, false);

  const destroy = () => {
    if (!win.isDestroyed()) win.destroy();
  };
  const onAbort = () => destroy();
  req.signal?.addEventListener('abort', onAbort, { once: true });

  const stills: ScriptedStill[] = [];
  const deadline = Date.now() + SCRIPT_TIMEOUT_MS;

  // Selector-scroll targets may sit below the fold — present is enough there.
  const requireVisibleOrPresent = async (selector: string) => {
    const m = await measureSelector(win, selector);
    if (!m.found) throw new Error(`scroll: no element matches selector "${selector}"`);
  };

  const runStep = async (step: CaptureScriptStep): Promise<void> => {
    switch (step.op) {
      case 'navigate':
        await loadUrl(win, step.url);
        return;
      case 'wait': {
        if (step.selector) {
          const budget = Math.min(step.ms ?? STEP_TIMEOUT_MS, STEP_TIMEOUT_MS);
          const until = Date.now() + budget;
          for (;;) {
            const m = await measureSelector(win, step.selector);
            if (m.found && m.visible) return;
            if (Date.now() >= until) {
              throw new Error(`waited ${budget / 1000} s but "${step.selector}" never became visible`);
            }
            await sleep(250);
          }
        }
        await sleep(Math.min(step.ms ?? 500, STEP_TIMEOUT_MS));
        return;
      }
      case 'scroll': {
        if (typeof step.to === 'number' || step.to === 'bottom') {
          const target = typeof step.to === 'number' ? String(Math.max(0, step.to)) : 'document.documentElement.scrollHeight';
          await win.webContents.executeJavaScript(
            `window.scrollTo({ top: ${target}, behavior: 'instant' }); undefined`,
            true,
          );
        } else {
          await requireVisibleOrPresent(step.to);
          await win.webContents.executeJavaScript(
            `document.querySelector(${JSON.stringify(step.to)})?.scrollIntoView({ block: 'start', behavior: 'instant' }); undefined`,
            true,
          );
        }
        await sleep(SETTLE_MS);
        return;
      }
      case 'type': {
        const m = await requireVisible(win, step.selector, 'type');
        await clickAt(win, m.x, m.y);
        await sleep(100);
        for (const ch of step.text) {
          if (ch === '\n') {
            win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
            win.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
            win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
          } else {
            win.webContents.sendInputEvent({ type: 'char', keyCode: ch });
          }
          await sleep(15);
        }
        await sleep(SETTLE_MS);
        return;
      }
      case 'click': {
        const m = await requireVisible(win, step.selector, 'click');
        await clickAt(win, m.x, m.y);
        await sleep(SETTLE_MS);
        return;
      }
      case 'capture': {
        const page = (await win.webContents.executeJavaScript(
          `({ title: document.title, url: location.href, scrollHeight: Math.max(
             document.documentElement ? document.documentElement.scrollHeight : 0,
             document.body ? document.body.scrollHeight : 0) })`,
          true,
        )) as { title: string; url: string; scrollHeight: number };

        const grew = step.fullPage === true && page.scrollHeight > viewport.height;
        if (grew) {
          const cssHeight = Math.min(page.scrollHeight, Math.floor(MAX_CAPTURE_HEIGHT / CAPTURE_SCALE));
          win.setSize(viewport.width * CAPTURE_SCALE, cssHeight * CAPTURE_SCALE);
          await sleep(500); // relayout
        }
        const image = await win.webContents.capturePage();
        if (grew) {
          win.setSize(viewport.width * CAPTURE_SCALE, viewport.height * CAPTURE_SCALE);
          await sleep(500); // restore layout for later steps
        }
        const png = image.toPNG();
        if (png.length === 0) throw new Error('capture produced an empty image');
        const size = image.getSize();

        // Content Safety Gate B (D2c call site 5): a blocked still fails this
        // step by name — earlier stills stay (partial-stills semantics).
        await checkImageBuffer(png);

        const root = await ensureLibraryRoot();
        const folder = domainFolder(page.url);
        const base = slugify(step.label, 'still');
        const { relPath, absPath } = await reserveLibraryFile(root, folder, base, '.png');
        await fs.writeFile(absPath, png);
        await upsertEntry(root, relPath, {
          origin: 'captured',
          description: scriptedStillDescription(step.label, page.title, page.url),
        });
        stills.push({ relPath, label: step.label, width: size.width, height: size.height });
        return;
      }
    }
  };

  try {
    await loadUrl(win, req.url);

    for (const [index, step] of req.steps.entries()) {
      if (req.signal?.aborted || win.isDestroyed()) {
        throw new Error('Scripted capture was cancelled');
      }
      if (Date.now() > deadline) {
        return {
          stills,
          failedStep: { index, op: step.op, error: `script exceeded ${SCRIPT_TIMEOUT_MS / 1000} s` },
        };
      }
      const stepBudget =
        step.op === 'navigate' ? NAV_TIMEOUT_MS + NAV_SETTLE_MS + 1_000
        : step.op === 'wait' ? Math.min(step.ms ?? STEP_TIMEOUT_MS, STEP_TIMEOUT_MS) + 1_000
        : STEP_TIMEOUT_MS;
      try {
        await withTimeout(runStep(step), stepBudget, `step ${index + 1} (${step.op})`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log.warn('Scripted capture step failed', { index, op: step.op, error });
        return { stills, failedStep: { index, op: step.op, error } };
      }
    }

    log.info('Scripted capture complete', { url: req.url, stills: stills.length });
    return { stills };
  } finally {
    req.signal?.removeEventListener('abort', onAbort);
    scriptedActive = false;
    destroy();
  }
}
