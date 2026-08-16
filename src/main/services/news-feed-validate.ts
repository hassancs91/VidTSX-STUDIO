// PURE validation for the announcements feed (Phase I trust rules 1+2):
// schema-validate and clamp in main, https:// links only, date-window and
// minAppVersion filtering. No fs, no fetch, no clock — `now` and
// `appVersion` are inputs, so every rule is unit-testable.
//
// Failure posture: a malformed MESSAGE is dropped silently; a malformed FEED
// yields []. A compromised or buggy feed can at worst show a weird sentence —
// never break the app.

import type { NewsMessage, NewsMessageType } from '../../shared/types/news-feed';

/** Clamps — a feed can't grow the renderer's card unbounded. */
const MAX_MESSAGES = 20;
const MAX_ID = 100;
const MAX_TITLE = 120;
const MAX_BODY = 500;
const MAX_CTA = 40;

/** Three-part numeric version compare ("1.2.3"; leading "v" tolerated;
 *  missing parts read as 0). Returns <0, 0, >0 like a comparator, or NaN
 *  when either side has a non-numeric part — callers must treat NaN as
 *  "invalid input", not "equal". */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] | null => {
    const parts = v.trim().replace(/^v/i, '').split('.');
    if (parts.length === 0 || parts.length > 3) return null;
    const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN));
    return nums.some(Number.isNaN) ? null : [...nums, 0, 0].slice(0, 3);
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return NaN;
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export interface ParseNewsFeedOptions {
  /** The evaluation instant for startsAt/endsAt windows. */
  now: Date;
  /** The running app's version, checked against each message's minAppVersion. */
  appVersion: string;
}

const isType = (v: unknown): v is NewsMessageType =>
  v === 'announcement' || v === 'tip' || v === 'promo';

const clampString = (v: unknown, max: number): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : null;

/** A date-only string ("2026-08-20") or full ISO string. Null = invalid. */
function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : new Date(ms);
}

function parseMessage(raw: unknown, opts: ParseNewsFeedOptions): NewsMessage | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const doc = raw as Record<string, unknown>;

  const id = clampString(doc.id, MAX_ID);
  const title = clampString(doc.title, MAX_TITLE);
  const body = clampString(doc.body, MAX_BODY);
  if (!id || !title || !body) return null;

  // Scheduling: a present-but-unparseable date drops the message (conservative
  // — better to show nothing than to show a campaign outside its window).
  if (doc.startsAt !== undefined) {
    const startsAt = parseDate(doc.startsAt);
    if (!startsAt || opts.now < startsAt) return null;
  }
  if (doc.endsAt !== undefined) {
    const endsAt = parseDate(doc.endsAt);
    if (!endsAt || opts.now > endsAt) return null;
  }
  if (doc.minAppVersion !== undefined) {
    if (typeof doc.minAppVersion !== 'string') return null;
    const cmp = compareVersions(opts.appVersion, doc.minAppVersion);
    if (Number.isNaN(cmp) || cmp < 0) return null;
  }

  // https:// only; a bad url drops the LINK, not the message.
  const url = clampString(doc.url, 2000);
  const httpsUrl = url && url.startsWith('https://') ? url : null;
  const cta = clampString(doc.cta, MAX_CTA);

  return {
    id,
    type: isType(doc.type) ? doc.type : 'announcement',
    title,
    body,
    ...(httpsUrl ? { url: httpsUrl } : {}),
    ...(httpsUrl && cta ? { cta } : {}),
  };
}

/** Raw fetched JSON → validated, clamped, in-window messages. Never throws. */
export function parseNewsFeed(raw: unknown, opts: ParseNewsFeedOptions): NewsMessage[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const messages = (raw as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) return [];
  const out: NewsMessage[] = [];
  const seen = new Set<string>();
  for (const entry of messages.slice(0, MAX_MESSAGES)) {
    const parsed = parseMessage(entry, opts);
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      out.push(parsed);
    }
  }
  return out;
}
