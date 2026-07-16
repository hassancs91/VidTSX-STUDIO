import { describe, expect, it } from 'vitest';
import { SD_MODEL_CATALOG } from './model-registry';
import {
  FLUX1_COMPANIONS,
  FLUX2_4B_COMPANIONS,
  FLUX2_9B_COMPANIONS,
  FLUX2_COMPANIONS,
} from './family-presets';
import type { CompanionRequirement } from './types';

/**
 * Catalog link sweep (backlog A4) — network-dependent, so it is SKIPPED unless
 * CHECK_LINKS is set. Run via `npm run check:links`.
 *
 * - Every `downloadUrl` is HEAD-requested (following HF's redirect to the LFS
 *   CDN); a non-200 fails the suite (gates a release). The served size
 *   (Content-Length / X-Linked-Size) is compared to the profile's `sizeBytes`;
 *   a delta > 10% is reported as SIZE-MISMATCH but does NOT fail — this is how
 *   the SD3.5 all-in-one GGUF understatement was originally found.
 * - `sourceUrl`s and companion `sourceUrl`s are pages, not files: a 200 only
 *   confirms the page exists (and JS-heavy hosts like Civitai may refuse HEAD
 *   entirely), so those are reported as status-only and never fail the suite.
 */

const RUN_SWEEP = Boolean(process.env.CHECK_LINKS);
const SIZE_TOLERANCE = 0.1;
const FETCH_TIMEOUT_MS = 30_000;
const SWEEP_TIMEOUT_MS = 180_000;

interface ProbeResult {
  status: number | null;
  serverSize: number | null;
  error?: string;
}

interface SweepRow {
  label: string;
  url: string;
  verdict: string;
  isDead: boolean;
  isMismatch: boolean;
}

function parseSize(headers: Headers): number | null {
  const raw = headers.get('x-linked-size') ?? headers.get('content-length');
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function probe(url: string, method: 'HEAD' | 'GET'): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'vidtsx-studio-link-sweep/1.0',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
    });
    let serverSize = parseSize(res.headers);
    if (method === 'GET') {
      // Range request: total size is the denominator of Content-Range.
      const range = res.headers.get('content-range');
      const total = range?.match(/\/(\d+)$/)?.[1];
      if (total) serverSize = Number.parseInt(total, 10);
      await res.body?.cancel();
    }
    return { status: res.status, serverSize };
  } catch (err) {
    return { status: null, serverSize: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** HEAD first; fall back to a 1-byte ranged GET for hosts that reject HEAD. */
async function probeFile(url: string): Promise<ProbeResult> {
  const head = await probe(url, 'HEAD');
  const headOk = head.status !== null && head.status >= 200 && head.status < 300;
  if (headOk && head.serverSize !== null) return head;
  const get = await probe(url, 'GET');
  const getOk = get.status !== null && get.status >= 200 && get.status < 300;
  return getOk ? get : headOk ? head : get;
}

function formatGB(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

function fileVerdict(result: ProbeResult, expectedSize: number): Pick<SweepRow, 'verdict' | 'isDead' | 'isMismatch'> {
  if (result.status === null) {
    return { verdict: `UNREACHABLE(${result.error ?? 'unknown'})`, isDead: true, isMismatch: false };
  }
  if (result.status < 200 || result.status >= 300) {
    return { verdict: `DEAD(${result.status})`, isDead: true, isMismatch: false };
  }
  if (result.serverSize === null) {
    return { verdict: 'OK(no size header)', isDead: false, isMismatch: false };
  }
  const delta = Math.abs(result.serverSize - expectedSize) / result.serverSize;
  if (delta > SIZE_TOLERANCE) {
    return {
      verdict: `SIZE-MISMATCH(expected ${formatGB(expectedSize)}, got ${formatGB(result.serverSize)})`,
      isDead: false,
      isMismatch: true,
    };
  }
  return { verdict: `OK(${formatGB(result.serverSize)})`, isDead: false, isMismatch: false };
}

function printTable(title: string, rows: SweepRow[]): void {
  const width = Math.max(...rows.map((r) => r.label.length));
  console.log(`\n── ${title} ──`);
  for (const row of rows) {
    console.log(`  ${row.label.padEnd(width)}  ${row.verdict}  ${row.url}`);
  }
}

describe.skipIf(!RUN_SWEEP)('catalog link sweep (CHECK_LINKS)', () => {
  it(
    'every downloadUrl is alive; served size within 10% of sizeBytes',
    async () => {
      const entries = SD_MODEL_CATALOG.filter(
        (p): p is typeof p & { downloadUrl: string } => typeof p.downloadUrl === 'string',
      );
      const rows: SweepRow[] = await Promise.all(
        entries.map(async (p) => {
          const result = await probeFile(p.downloadUrl);
          return { label: p.id, url: p.downloadUrl, ...fileVerdict(result, p.sizeBytes) };
        }),
      );

      printTable(`downloadUrl sweep (${rows.length} entries)`, rows);
      const dead = rows.filter((r) => r.isDead);
      const mismatched = rows.filter((r) => r.isMismatch);
      console.log(
        `\nSummary: ${rows.length - dead.length - mismatched.length} OK, ` +
          `${mismatched.length} size-mismatch (warning), ${dead.length} dead`,
      );
      for (const row of mismatched) {
        console.warn(`WARNING ${row.label}: ${row.verdict}`);
      }

      expect(dead.map((r) => `${r.label}: ${r.verdict}`)).toEqual([]);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    'sourceUrl pages respond (status report only — 200 confirms the page, not the file)',
    async () => {
      const rows: SweepRow[] = await Promise.all(
        SD_MODEL_CATALOG.map(async (p) => {
          const result = await probe(p.sourceUrl, 'HEAD');
          const status = result.status === null ? `UNREACHABLE(${result.error ?? 'unknown'})` : String(result.status);
          const linkOnly = p.downloadUrl ? '' : ' [link-only]';
          return {
            label: `${p.id}${linkOnly}`,
            url: p.sourceUrl,
            verdict: status,
            isDead: false,
            isMismatch: false,
          };
        }),
      );
      printTable(`sourceUrl page sweep (${rows.length} entries, informational)`, rows);
      expect(rows.length).toBeGreaterThan(0);
    },
    SWEEP_TIMEOUT_MS,
  );

  it(
    'companion sourceUrl pages respond (status report only)',
    async () => {
      const companionSets: Array<[string, CompanionRequirement[]]> = [
        ['FLUX1_COMPANIONS', FLUX1_COMPANIONS],
        ['FLUX2_4B_COMPANIONS', FLUX2_4B_COMPANIONS],
        ['FLUX2_9B_COMPANIONS', FLUX2_9B_COMPANIONS],
        ['FLUX2_COMPANIONS', FLUX2_COMPANIONS],
      ];
      const unique = new Map<string, string>();
      for (const [setName, companions] of companionSets) {
        for (const c of companions) {
          const label = `${setName}:${c.kind}`;
          const existing = unique.get(c.sourceUrl);
          unique.set(c.sourceUrl, existing ? `${existing}, ${label}` : label);
        }
      }
      const rows: SweepRow[] = await Promise.all(
        [...unique.entries()].map(async ([url, label]) => {
          const result = await probe(url, 'HEAD');
          const status = result.status === null ? `UNREACHABLE(${result.error ?? 'unknown'})` : String(result.status);
          return { label, url, verdict: status, isDead: false, isMismatch: false };
        }),
      );
      printTable(`companion sourceUrl sweep (${rows.length} unique URLs, informational)`, rows);
      expect(rows.length).toBeGreaterThan(0);
    },
    SWEEP_TIMEOUT_MS,
  );
});
