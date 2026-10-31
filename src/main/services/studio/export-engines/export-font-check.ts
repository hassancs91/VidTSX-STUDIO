/**
 * The export font preflight, against the real cache (docs/studio/END_TO_END_PLAN.md §2 T7,
 * part A4): every Google Fonts URL the export's shot copies carry (`entry.fontUrls`, collected
 * by `createExportEntry`) is warmed into `<userData>/font-cache` BEFORE the render starts, so
 * the render is served from disk and never reaches Google Fonts. What cannot be cached is
 * judged by `font-preflight.ts` — a refusal names the families.
 */
import { logEngine } from '../../../../logging/log-engine';
import { ensureFontCached } from '../../font-proxy';
import { fontPreflightVerdict, type FontPreflightVerdict } from './font-preflight';

const log = logEngine.createLogger('StudioExportFonts');

/** Parallel upstream fetches: a cold video-14 is ~100 URLs; Google Fonts is fast but polite. */
const CONCURRENCY = 6;

/** Warm and judge; never throws. An empty list (no Google Fonts, or an older entry) is ok. */
export async function checkExportFonts(jobId: string, urls: readonly string[]): Promise<FontPreflightVerdict> {
  if (urls.length === 0) return fontPreflightVerdict([], []);
  const startedAt = Date.now();
  const failed: string[] = [];
  let fetched = 0;
  let cached = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const result = await ensureFontCached(url);
        fetched += result.fetched;
        cached += result.cached;
      } catch (err) {
        failed.push(url);
        log.debug('Font not cached for export', { jobId, url, error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  // Input order, not completion order: the message names families the same way every time.
  const failedSet = new Set(failed);
  const verdict = fontPreflightVerdict(urls, urls.filter((url) => failedSet.has(url)));
  log.info('Export font preflight', {
    jobId,
    urls: urls.length,
    filesFetched: fetched,
    filesCached: cached,
    failed: failed.length,
    families: verdict.families,
    ms: Date.now() - startedAt,
  });
  return verdict;
}
