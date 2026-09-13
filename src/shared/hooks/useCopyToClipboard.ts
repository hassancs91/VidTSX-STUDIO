import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * One place for "put this text on the clipboard". Every copy affordance in
 * the app goes through here so the failure mode (clipboard unavailable in a
 * sandboxed window, permission denied) is handled once: the promise resolves
 * to whether the copy landed and never throws.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const COPIED_FLASH_MS = 1500;

export interface UseCopyToClipboardResult {
  /** Copies `text`; resolves to whether it landed. */
  copy: (text: string) => Promise<boolean>;
  /** True for a moment after a successful copy — for an in-place "Copied" flash. */
  copied: boolean;
}

/** The copy function plus a short-lived `copied` flag for the button that
 *  called it (no toast — the flash is the feedback). */
export function useCopyToClipboard(flashMs = COPIED_FLASH_MS): UseCopyToClipboardResult {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyTextToClipboard(text);
      if (ok) {
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          setCopied(false);
        }, flashMs);
      }
      return ok;
    },
    [flashMs],
  );

  return { copied, copy };
}
