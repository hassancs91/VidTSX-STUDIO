// The filter runtime the host vendors from the add-ons SDK
// (docs/studio/FILTER_PACKS_DESIGN.md ★1): `core/parameters.ts` and
// `core/renderer.ts` of D:/repos/vidtsx-addons/filters, behaviour unchanged —
// cover crop, intensity blend, mirror, face and mask normalisation. Types are
// in shared/types/studio-effects.ts. Browser-only (Canvas 2D): the composition
// and the gallery cards use it; main never imports it.
//
// P0 (2026-09-18) ran this exact code through @remotion/renderer and
// @remotion/player: stills byte-identical across runs, audio untouched.

import type {
  FilterDefinition,
  FilterFace,
  FilterFrameInput,
  FilterPoint,
} from '../types/studio-effects';

export interface FilterRenderer {
  /** Paint `frame.source` through `filter` (or untouched when null) into the output canvas. */
  render(filter: FilterDefinition | null, frame: FilterFrameInput): void;
  dispose(): void;
}

/** A loaded module's default export is a filter when it carries the contract's essentials. */
export function isFilterDefinition(value: unknown): value is FilterDefinition {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.render === 'function' && typeof v.defaultIntensity === 'number';
}

/** The filter's parameters with the document's values applied: unknown keys ignored, invalid values defaulted, ranges clamped. */
export function resolveFilterParameters(
  filter: Pick<FilterDefinition, 'parameters'>,
  input: Readonly<Record<string, number | string>> = {},
): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  for (const spec of filter.parameters ?? []) {
    const value = input[spec.key];
    result[spec.key] =
      spec.type === 'color'
        ? typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
          ? value
          : spec.default
        : typeof value === 'number' && Number.isFinite(value)
          ? Math.max(spec.min, Math.min(spec.max, value))
          : spec.default;
  }
  return result;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('A Canvas 2D context is required.');
  return ctx;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return el;
}

/** Pixel size of a CanvasImageSource, or null while it has none (a video before its metadata). */
export function filterSourceSize(source: CanvasImageSource): { width: number; height: number } | null {
  let width = 0;
  let height = 0;
  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
  } else if (source instanceof HTMLImageElement) {
    width = source.naturalWidth;
    height = source.naturalHeight;
  } else if ('displayWidth' in source) {
    width = source.displayWidth;
    height = source.displayHeight;
  } else if ('width' in source && typeof source.width === 'number' && typeof source.height === 'number') {
    width = source.width;
    height = source.height;
  }
  return width > 0 && height > 0 ? { width, height } : null;
}

function safeFace(face: FilterFace): boolean {
  return (
    [face.center, face.leftEye, face.rightEye, face.nose, face.mouth, face.forehead].every(
      (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y),
    ) &&
    Number.isFinite(face.rotation) &&
    Number.isFinite(face.width) &&
    Number.isFinite(face.height) &&
    face.width > 0 &&
    face.height > 0
  );
}

/** One renderer per output canvas. The source is cover-cropped into it; landmarks follow the crop. */
export function createFilterRenderer(output: HTMLCanvasElement): FilterRenderer {
  const source = makeCanvas(output.width, output.height);
  const effect = makeCanvas(output.width, output.height);
  const scratch = makeCanvas(1, 1);
  const inputCtx = context2d(source);
  const effectCtx = context2d(effect);
  const outputCtx = context2d(output);
  let disposed = false;
  const buffers = new Map<string, HTMLCanvasElement>();
  function buffer(name: string, width: number, height: number): HTMLCanvasElement {
    let value = buffers.get(name);
    if (!value) {
      value = makeCanvas(width, height);
      buffers.set(name, value);
    }
    if (value.width !== width || value.height !== height) {
      value.width = width;
      value.height = height;
    }
    return value;
  }
  return {
    render(filter, frame) {
      if (disposed) throw new Error('Renderer has been disposed.');
      const w = output.width;
      const h = output.height;
      if (!w || !h) throw new Error('Output dimensions must be positive.');
      const dimensions = filterSourceSize(frame.source);
      if (!dimensions) throw new Error('Source is not ready.');
      for (const c of [source, effect]) {
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
      }
      const scale = Math.max(w / dimensions.width, h / dimensions.height);
      const dw = dimensions.width * scale;
      const dh = dimensions.height * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      inputCtx.clearRect(0, 0, w, h);
      inputCtx.drawImage(frame.source, dx, dy, dw, dh);
      const point = (p: FilterPoint): FilterPoint => ({ x: (p.x * dw + dx) / w, y: (p.y * dh + dy) / h });
      const faces = (frame.faces ?? []).filter(safeFace).map((face) => ({
        ...face,
        center: point(face.center),
        leftEye: point(face.leftEye),
        rightEye: point(face.rightEye),
        nose: point(face.nose),
        mouth: point(face.mouth),
        forehead: point(face.forehead),
        width: (face.width * dw) / w,
        height: (face.height * dh) / h,
      }));
      const raw = frame.options?.intensity ?? filter?.defaultIntensity ?? 1;
      const intensity = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 1;
      const rawSpeed = frame.options?.speed ?? 1;
      const speed = Number.isFinite(rawSpeed) ? Math.max(0, Math.min(3, rawSpeed)) : 1;
      let subjectMask: HTMLCanvasElement | undefined;
      const mask = frame.subjectMask;
      const sourceTime = frame.sourceTime ?? frame.time;
      if (
        filter?.subjectTracking &&
        intensity > 0 &&
        mask &&
        Number.isFinite(mask.time) &&
        Number.isFinite(sourceTime) &&
        Math.abs(mask.time - sourceTime) <= 0.001 &&
        mask.sourceWidth === dimensions.width &&
        mask.sourceHeight === dimensions.height &&
        Number.isInteger(mask.width) &&
        Number.isInteger(mask.height) &&
        mask.width > 0 &&
        mask.height > 0 &&
        mask.width <= 4096 &&
        mask.height <= 4096 &&
        mask.data instanceof Uint8ClampedArray &&
        mask.data.length === mask.width * mask.height
      ) {
        const rawMask = buffer('mask-input', mask.width, mask.height);
        const maskCtx = context2d(rawMask);
        const pixels = maskCtx.createImageData(mask.width, mask.height);
        let present = false;
        for (let i = 0; i < mask.data.length; i++) {
          pixels.data[i * 4] = pixels.data[i * 4 + 1] = pixels.data[i * 4 + 2] = 255;
          pixels.data[i * 4 + 3] = mask.data[i];
          if (mask.data[i] > 0) present = true;
        }
        if (present) {
          maskCtx.putImageData(pixels, 0, 0);
          const ratio = Math.min(1, 256 / Math.max(w, h));
          subjectMask = buffer('mask-output', Math.max(1, Math.round(w * ratio)), Math.max(1, Math.round(h * ratio)));
          const normalized = context2d(subjectMask);
          normalized.clearRect(0, 0, subjectMask.width, subjectMask.height);
          normalized.drawImage(
            rawMask,
            (dx * subjectMask.width) / w,
            (dy * subjectMask.height) / h,
            (dw * subjectMask.width) / w,
            (dh * subjectMask.height) / h,
          );
        }
      }
      outputCtx.save();
      outputCtx.resetTransform();
      outputCtx.clearRect(0, 0, w, h);
      if (frame.options?.mirror) {
        outputCtx.translate(w, 0);
        outputCtx.scale(-1, 1);
      }
      outputCtx.drawImage(source, 0, 0);
      if (filter && intensity > 0) {
        effectCtx.save();
        effectCtx.clearRect(0, 0, w, h);
        try {
          filter.render({
            ctx: effectCtx,
            source,
            scratch,
            width: w,
            height: h,
            time: (Number.isFinite(frame.time) ? Math.max(0, frame.time) : 0) * speed,
            intensity,
            faces,
            subjectMask,
            parameters: resolveFilterParameters(filter, frame.options?.parameters),
            buffer: (name, width, height) => buffer(`${filter.id}:${name}`, width, height),
          });
        } finally {
          effectCtx.restore();
        }
        outputCtx.globalAlpha = intensity;
        outputCtx.drawImage(effect, 0, 0);
      }
      outputCtx.restore();
    },
    dispose() {
      for (const c of [source, effect, scratch, ...buffers.values()]) {
        c.width = 1;
        c.height = 1;
      }
      buffers.clear();
      disposed = true;
    },
  };
}
