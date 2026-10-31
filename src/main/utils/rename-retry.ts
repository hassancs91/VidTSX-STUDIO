import fs from 'fs/promises';

/** Codes Windows returns while another process holds the target (or the
 *  source) open: an antivirus scan, a search indexer, a sync client, a
 *  script polling the file. They clear by themselves once that read ends. */
const TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

export interface RenameRetryOptions {
  /** Total tries, the first included (default 8). */
  attempts?: number;
  /** Wait before try n+1 = baseDelayMs × n (default 50 → 1.4 s worst case). */
  baseDelayMs?: number;
  /** Test seam; defaults to `fs.rename`, read at call time. */
  renameImpl?: (from: string, to: string) => Promise<void>;
}

/**
 * `fs.rename` with a short linear backoff on Windows' transient lock errors.
 * An atomic write (temp file, then rename over the target) fails outright on
 * Windows while any reader has the target open — B5 saw project.json saves
 * refused with EPERM by a 50 ms poller. Any other error (ENOENT, ENOSPC …)
 * is thrown at once, and the last lock error is thrown when tries run out.
 */
export async function renameWithRetry(from: string, to: string, options: RenameRetryOptions = {}): Promise<void> {
  const attempts = Math.max(1, options.attempts ?? 8);
  const baseDelayMs = options.baseDelayMs ?? 50;
  const rename = options.renameImpl ?? ((a: string, b: string) => fs.rename(a, b));
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (!code || !TRANSIENT_CODES.has(code) || attempt >= attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * attempt));
    }
  }
}
