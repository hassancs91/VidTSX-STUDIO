/**
 * Dev-only stand-ins for the runtime preflight (docs/ui-automation-cdp.md): the guards
 * for path length, disk space and the driver floor depend on machine facts that a test
 * cannot change, so an automated run sets one JSON environment variable instead:
 *
 *   VIDTSX_AI_RUNTIME_OVERRIDES='{"root":"C:\\very\\long\\path","freeBytes":1000,
 *                                 "driverVersion":"470.00","vramTotalMB":2048,"gpuName":null}'
 *
 * Every field is optional. Ignored in packaged builds (the VIDTSX_RELINK_PICK /
 * VIDTSX_PACKAGE_SAVE precedent). Parsed once per process.
 */

export interface AiRuntimeDevOverrides {
  /** Replaces getAiRuntimeRoot() — a long path exercises the MAX_PATH guard. */
  root?: string;
  /** Replaces the free-bytes probe of the runtime root's drive. */
  freeBytes?: number;
  /** Replaces nvidia-smi's driver version (e.g. "470.00" to trip the floor). */
  driverVersion?: string | null;
  /** Replaces nvidia-smi's total VRAM. */
  vramTotalMB?: number | null;
  /** Replaces the GPU name; null = "no NVIDIA GPU". */
  gpuName?: string | null;
}

const ENV_NAME = 'VIDTSX_AI_RUNTIME_OVERRIDES';

let cached: AiRuntimeDevOverrides | null | undefined;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Pure parser (tested): unknown or malformed input → null. */
export function parseAiRuntimeDevOverrides(raw: string | undefined, packaged: boolean): AiRuntimeDevOverrides | null {
  if (packaged || !raw) return null;
  try {
    const obj: unknown = JSON.parse(raw);
    if (!isRecord(obj)) return null;
    const out: AiRuntimeDevOverrides = {};
    if (typeof obj.root === 'string' && obj.root.length > 0) out.root = obj.root;
    if (typeof obj.freeBytes === 'number' && Number.isFinite(obj.freeBytes) && obj.freeBytes >= 0) out.freeBytes = obj.freeBytes;
    if (typeof obj.driverVersion === 'string' || obj.driverVersion === null) out.driverVersion = obj.driverVersion;
    if ((typeof obj.vramTotalMB === 'number' && Number.isFinite(obj.vramTotalMB)) || obj.vramTotalMB === null) out.vramTotalMB = obj.vramTotalMB;
    if (typeof obj.gpuName === 'string' || obj.gpuName === null) out.gpuName = obj.gpuName;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Overrides for this process, or null (always null in packaged builds). */
export function getAiRuntimeDevOverrides(): AiRuntimeDevOverrides | null {
  if (cached === undefined) {
    // `electron` is not imported here so the ai-runtime modules stay unit-testable in
    // plain Node; Electron sets `process.defaultApp` only when launched as `electron <dir>`
    // (electron-vite dev), never in a packaged build.
    const packaged = !process.defaultApp;
    cached = parseAiRuntimeDevOverrides(process.env[ENV_NAME], packaged);
  }
  return cached;
}

/** Test-only. */
export function __resetAiRuntimeDevOverrides(): void {
  cached = undefined;
}
