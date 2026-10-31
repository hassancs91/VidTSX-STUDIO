/**
 * One Google Fonts download, with ONE retry on a transient failure
 * (docs/studio/END_TO_END_PLAN.md part A5, step 0.2).
 *
 * Why: the A4 verifier's cold export preflight fetched ~100 font files and 2 died mid-body
 * with undici's `terminated` while the rest downloaded; with no retry the strict preflight
 * refused the export. A network error (fetch or the body read rejects) or a 5xx is retried
 * once after a short pause; a 404 or any other 4xx is not (the file does not exist / the
 * request is wrong — asking again cannot help).
 */
import { logEngine } from '../../logging/log-engine';

const log = logEngine.createLogger('FontProxy');

/** A blip (a reset connection, a 503) usually clears within a second. */
const RETRY_DELAY_MS = 500;

/** gstatic.com sniffs the user agent for woff2 vs woff — a Chrome UA gets woff2. */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** The upstream answered with a non-2xx status. */
export class FontUpstreamStatusError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`Upstream ${status} for ${url}`);
    this.name = 'FontUpstreamStatusError';
  }
}

/** A network error or a 5xx can clear on its own; a 4xx (404 first of all) cannot. */
export function isTransientFontFetchError(err: unknown): boolean {
  if (err instanceof FontUpstreamStatusError) return err.status >= 500;
  return true;
}

export interface FontFetchOptions {
  /** Pause before the one retry (tests pass 0). */
  retryDelayMs?: number;
}

/** The file's bytes, or the error of the last attempt (at most two requests). */
export async function fetchFontBytes(url: string, opts: FontFetchOptions = {}): Promise<Buffer> {
  try {
    return await fetchOnce(url);
  } catch (err) {
    if (!isTransientFontFetchError(err)) throw err;
    log.warn('Font fetch failed; retrying once', { url, error: err instanceof Error ? err.message : String(err) });
    await new Promise<void>((resolve) => setTimeout(resolve, opts.retryDelayMs ?? RETRY_DELAY_MS));
    return fetchOnce(url);
  }
}

async function fetchOnce(url: string): Promise<Buffer> {
  const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!resp.ok) throw new FontUpstreamStatusError(resp.status, url);
  return Buffer.from(await resp.arrayBuffer());
}
