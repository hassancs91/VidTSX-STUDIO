// Announcements feed service (Phase I1) — fetch vidtsx.com/app/feed.json,
// validate through the pure parser, and keep a last-good cache so the card
// still renders offline. Trust rules (V1_RELEASE_PLAN Phase I): plain GET
// with nothing about the user in the request, once per launch, fail silent
// (offline/404/garbage → empty or cached, never an error surfaced), and the
// raw body is cached — validation re-runs at serve time so date windows and
// version targeting stay fresh.
//
// I2 (settings: enabled flag + dismissed ids) and I3 (IPC) layer on top of
// getNewsMessages() — this service knows nothing about either.

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { logEngine } from '../../logging/log-engine';
import type { NewsMessage } from '../../shared/types/news-feed';
import { parseNewsFeed } from './news-feed-validate';

const log = logEngine.createLogger('NewsFeed');

/** The ONE place the feed URL lives. Uploading a new static file to the site
 *  changes what every running app shows next launch — no release needed. */
export const NEWS_FEED_URL = 'https://vidtsx.com/app/feed.json';

const FETCH_TIMEOUT_MS = 10_000;
/** A feed bigger than this is malformed or malicious — ignore it. */
const MAX_BODY_BYTES = 256 * 1024;

function getCachePath(): string {
  return path.join(app.getPath('userData'), 'news-feed-cache.json');
}

/** Once per launch: the raw fetch is memoized, not its validation. */
let launchFetch: Promise<unknown | null> | null = null;

/** Test seam — clears the once-per-launch memo (clearSkillCache precedent). */
export function resetNewsFeed(): void {
  launchFetch = null;
}

async function readCache(): Promise<unknown | null> {
  try {
    return JSON.parse(await fs.readFile(getCachePath(), 'utf-8')) as unknown;
  } catch {
    return null; // No cache yet, or unreadable — same as no news.
  }
}

async function writeCache(rawText: string): Promise<void> {
  const cachePath = getCachePath();
  const tmpPath = `${cachePath}.tmp`;
  await fs.writeFile(tmpPath, rawText, 'utf-8');
  await fs.rename(tmpPath, cachePath);
}

/** Plain GET → parsed JSON, or null on ANY failure. Never throws. */
async function fetchRaw(fetchImpl: typeof fetch): Promise<unknown | null> {
  try {
    const response = await fetchImpl(NEWS_FEED_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > MAX_BODY_BYTES) {
      log.warn('Feed body over size cap — ignoring', { bytes: text.length });
      return null;
    }
    const raw = JSON.parse(text) as unknown;
    await writeCache(text); // Only a fetch that parsed as JSON becomes last-good.
    return raw;
  } catch {
    return null; // Offline, DNS, timeout, non-JSON — all silent by design.
  }
}

export interface GetNewsOptions {
  appVersion: string;
  now?: Date;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** Validated, in-window messages: this launch's fetch if it succeeded,
 *  else the last-good cache, else []. Never throws. */
export async function getNewsMessages(options: GetNewsOptions): Promise<NewsMessage[]> {
  const { appVersion, now = new Date(), fetchImpl = fetch } = options;
  if (!launchFetch) {
    launchFetch = fetchRaw(fetchImpl);
  }
  const fetched = await launchFetch;
  const raw = fetched ?? (await readCache());
  if (raw === null) return [];
  return parseNewsFeed(raw, { now, appVersion });
}
