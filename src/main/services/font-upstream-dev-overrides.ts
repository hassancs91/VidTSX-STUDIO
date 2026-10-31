/**
 * Dev-only stand-in for "Google Fonts is unreachable" (docs/ui-automation-cdp.md, the
 * VIDTSX_EXPORT_DISK_OVERRIDES precedent, END_TO_END A4): the font proxy's upstream fetch
 * fails as if offline, so an automated run can warm the cache, block, and export from the
 * cache — or block with a cold cache and see the export preflight refuse.
 *
 *   VIDTSX_FONT_UPSTREAM_OVERRIDES='{"block":true}'                     blocked for the process
 *   VIDTSX_FONT_UPSTREAM_OVERRIDES='{"blockWhileExists":"D:\\x\\block"}' blocked while that file exists
 *
 * Ignored in packaged builds. Parsed once per process; the file is checked on every fetch.
 */
import fs from 'fs';

export interface FontUpstreamDevOverrides {
  block: boolean;
  /** Blocked only while this file exists (toggle without a restart). */
  blockWhileExists?: string;
}

const ENV_NAME = 'VIDTSX_FONT_UPSTREAM_OVERRIDES';

let cached: FontUpstreamDevOverrides | null | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Pure parser (tested): unknown or malformed input → null. */
export function parseFontUpstreamDevOverrides(raw: string | undefined, packaged: boolean): FontUpstreamDevOverrides | null {
  if (packaged || !raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!isRecord(obj)) return null;
    if (typeof obj.blockWhileExists === 'string' && obj.blockWhileExists.length > 0) {
      return { block: false, blockWhileExists: obj.blockWhileExists };
    }
    return obj.block === true ? { block: true } : null;
  } catch {
    return null;
  }
}

/** True when the dev override says the upstream is down right now (always false packaged). */
export function isFontUpstreamBlocked(): boolean {
  if (cached === undefined) {
    // Electron sets `process.defaultApp` only when launched as `electron <dir>` (dev), never packaged.
    cached = parseFontUpstreamDevOverrides(process.env[ENV_NAME], !process.defaultApp);
  }
  if (!cached) return false;
  if (cached.blockWhileExists) return fs.existsSync(cached.blockWhileExists);
  return cached.block;
}
