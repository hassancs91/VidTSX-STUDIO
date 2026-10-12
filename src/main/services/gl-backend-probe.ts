// Which GL backend draws WebGL well on this machine (TSX_BUILDER_DESIGN.md
// T4 Rev 2 item 1, P2 part 2).
//
// With no `gl` option Remotion adds no GL flag and Chromium draws WebGL on
// SwiftShader (CPU): a 3D scene with post-processing takes seconds a frame.
// `gl: 'angle'` puts WebGL on the GPU (D3D11 on Windows). A machine with no
// usable GPU answers `angle` with SwiftShader or WARP (Microsoft's software
// D3D), or with no WebGL at all; there the answer is `swangle`, Remotion's
// tested software path.
//
// The probe opens Remotion's own browser (the one renderStill launches, with
// the same flags) on `angle` and reads WEBGL_debug_renderer_info's unmasked
// renderer on a blank page: no bundle, about a second. Once per app run;
// callers share the answer. It never throws: any failure answers `swangle`
// and says why.
//
// Exports use it too: the Settings default `auto` (Hasan's pick 10-12, option
// c) resolves here at the two places a GL backend reaches Remotion
// (remotion-renderer.ts, webp-render.ts); an explicit pick passes through.
// Measured on the RTX A3000: GPU and swangle frames match to the eye, and the
// GPU exports heavy 3D 13x and an SVG-filter 2D piece 9x faster.

import { openBrowser, type HeadlessBrowser } from '@remotion/renderer';
import { logEngine } from '../../logging/log-engine';
import type { RenderGpuBackend } from '../../shared/ipc/types/render';

const log = logEngine.createLogger('GlProbe');

export type ProbedGl = Extract<RenderGpuBackend, 'angle' | 'swangle'>;
/** A backend Remotion's `gl` option accepts: anything but `auto`. */
export type RemotionGl = Exclude<RenderGpuBackend, 'auto'>;

export interface GlProbe {
  gl: ProbedGl;
  /** What WebGL reported on `angle` (the unmasked renderer), or '' when there was none. */
  renderer: string;
  reason: string;
  ms: number;
}

const PROBE_TIMEOUT_MS = 30_000;

/** Software rasterisers ANGLE can land on: SwiftShader, WARP, Mesa's llvmpipe / softpipe. */
const SOFTWARE_RENDERER = /swiftshader|basic render driver|llvmpipe|softpipe|software/i;

/** A string, not a function: the main bundle's helpers must not leak into the page. */
const READ_RENDERER = `(() => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) return '';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
})()`;

/** The backend for what WebGL reported on `angle`. */
export function pickGlBackend(renderer: string): Pick<GlProbe, 'gl' | 'reason'> {
  if (!renderer) return { gl: 'swangle', reason: 'no WebGL on angle' };
  if (SOFTWARE_RENDERER.test(renderer)) return { gl: 'swangle', reason: 'angle draws in software here' };
  return { gl: 'angle', reason: 'GPU' };
}

async function readAngleRenderer(): Promise<string> {
  let browser: HeadlessBrowser | null = null;
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer in ${PROBE_TIMEOUT_MS / 1000} s`)), PROBE_TIMEOUT_MS);
  });
  try {
    const read = async () => {
      browser = await openBrowser('chrome', { chromiumOptions: { gl: 'angle' }, logLevel: 'error' });
      const page = await browser.newPage({
        context: () => null,
        logLevel: 'error',
        indent: false,
        pageIndex: 0,
        onBrowserLog: null,
        onLog: () => undefined,
      });
      return String((await page.evaluate(READ_RENDERER)) ?? '');
    };
    return await Promise.race([read(), timeout]);
  } finally {
    clearTimeout(timer);
    const opened = browser as HeadlessBrowser | null;
    await opened?.close({ silent: true }).catch(() => undefined);
  }
}

async function probe(): Promise<GlProbe> {
  const started = Date.now();
  let result: GlProbe;
  try {
    const renderer = await readAngleRenderer();
    result = { ...pickGlBackend(renderer), renderer, ms: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result = { gl: 'swangle', renderer: '', reason: `angle probe failed: ${message}`, ms: Date.now() - started };
  }
  log.info(`GL backend: ${result.gl} (${result.reason}; ${result.renderer || 'no renderer'}; ${result.ms} ms)`);
  return result;
}

let probed: Promise<GlProbe> | null = null;

/** The GL backend for renders that need WebGL, probed once per app run. Never rejects. */
export function probeGlBackend(): Promise<GlProbe> {
  probed ??= probe();
  return probed;
}

/** Remotion's `gl` for a render: `auto` → the probed backend, an explicit one as is, none → none (Remotion's default). */
export async function resolveGpuBackend(value: RenderGpuBackend | undefined): Promise<RemotionGl | undefined> {
  if (value !== 'auto') return value;
  return (await probeGlBackend()).gl;
}

/** Tests only: forget the cached answer. */
export function resetGlProbe(): void {
  probed = null;
}
