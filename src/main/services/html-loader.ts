import { BrowserWindow } from 'electron';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getTempDir, ensureTempDir } from '../utils/paths';

/**
 * Loads HTML into a BrowserWindow via a temp file so that
 * external scripts (CDN), CSS, and fonts load correctly.
 * Waits for the page to fully load before resolving.
 * Returns the temp file path for cleanup.
 */
export async function loadHtmlInWindow(
  win: BrowserWindow,
  html: string,
): Promise<string> {
  await ensureTempDir();

  const tempFile = path.join(getTempDir(), `preview-${crypto.randomUUID()}.html`);
  await writeFile(tempFile, html, 'utf-8');

  await win.loadFile(tempFile);

  // Wait for all resources (scripts, images, fonts) to finish loading
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 300);
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 300));
      }
    })
  `);

  return tempFile;
}

export async function cleanupTempFile(tempFile: string): Promise<void> {
  try {
    await unlink(tempFile);
  } catch {
    // Ignore cleanup errors
  }
}
