/**
 * Dev-only stand-in for the export disk preflight's free-space probe
 * (docs/ui-automation-cdp.md, the VIDTSX_AI_RUNTIME_OVERRIDES precedent): an
 * automated run shows the refusal and its numbers without filling a disk.
 *
 *   VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":1000}'                  every drive
 *   VIDTSX_EXPORT_DISK_OVERRIDES='{"freeBytes":{"C:":1000}}'           one drive (by its label)
 *
 * Ignored in packaged builds. Parsed once per process.
 */

export interface ExportDiskDevOverrides {
  /** Free bytes for every drive, or per drive label ("C:"). */
  freeBytes: number | Record<string, number>;
}

const ENV_NAME = 'VIDTSX_EXPORT_DISK_OVERRIDES';

let cached: ExportDiskDevOverrides | null | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isBytes(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/** Pure parser (tested): unknown or malformed input → null. */
export function parseExportDiskDevOverrides(raw: string | undefined, packaged: boolean): ExportDiskDevOverrides | null {
  if (packaged || !raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!isRecord(obj)) return null;
    if (isBytes(obj.freeBytes)) return { freeBytes: obj.freeBytes };
    if (isRecord(obj.freeBytes)) {
      const perDrive: Record<string, number> = {};
      for (const [label, value] of Object.entries(obj.freeBytes)) {
        if (isBytes(value)) perDrive[label.toUpperCase()] = value;
      }
      return Object.keys(perDrive).length > 0 ? { freeBytes: perDrive } : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** The stand-in free bytes for a drive label, or undefined (always undefined in packaged builds). */
export function devFreeBytesFor(label: string): number | undefined {
  if (cached === undefined) {
    // Electron sets `process.defaultApp` only when launched as `electron <dir>` (dev), never packaged.
    cached = parseExportDiskDevOverrides(process.env[ENV_NAME], !process.defaultApp);
  }
  if (!cached) return undefined;
  return typeof cached.freeBytes === 'number' ? cached.freeBytes : cached.freeBytes[label.toUpperCase()];
}
