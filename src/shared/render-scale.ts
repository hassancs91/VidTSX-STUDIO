export interface SnappedRenderScale {
  /** Scale to pass to renderMedia — output dims are exact even integers. */
  scale: number;
  /** Output width: compWidth × scale. */
  width: number;
  /** Output height: compHeight × scale. */
  height: number;
}

/**
 * Find the scale closest to `requestedScale` whose output dimensions
 * (compWidth × scale, compHeight × scale) are exact even integers.
 *
 * Remotion's `scale` option maps to Chromium's deviceScaleFactor: the page
 * still lays out at the composition's real width/height and only the finished
 * bitmap is resized, so it scales ALL content correctly — including elements
 * sized in absolute pixels. Overriding the composition's width/height instead
 * re-lays-out the content, which leaves pixel-sized elements at their design
 * size inside a smaller canvas (oversized and cropped output).
 *
 * The catch: Remotion's stitcher strict-validates `width × scale % 1 === 0`
 * (and h264/h265 need even dims), evaluated in ordinary float arithmetic. So
 * candidates are checked with the very same float expressions Remotion uses.
 *
 * Valid scales have the form 2n / gcd(w, h): both outputs are then integer
 * multiples of the composition's coprime aspect units, and n is kept even-
 * producing. Candidates around the requested scale are tried nearest-first;
 * returns null when none lands within ±10% (pathological composition dims,
 * e.g. near-coprime width/height) — callers must fall back to another
 * strategy.
 */
export function snapRenderScale(
  compWidth: number,
  compHeight: number,
  requestedScale: number
): SnappedRenderScale | null {
  if (
    !Number.isInteger(compWidth) || compWidth <= 0 ||
    !Number.isInteger(compHeight) || compHeight <= 0 ||
    !Number.isFinite(requestedScale) || requestedScale <= 0
  ) {
    return null;
  }

  const isValid = (scale: number): SnappedRenderScale | null => {
    // Same expressions Remotion evaluates — float exactness required.
    const w = compWidth * scale;
    const h = compHeight * scale;
    if (Number.isInteger(w) && Number.isInteger(h) && w % 2 === 0 && h % 2 === 0 && w >= 2 && h >= 2) {
      return { scale, width: w, height: h };
    }
    return null;
  };

  const requested = isValid(requestedScale);
  if (requested) return requested;

  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(compWidth, compHeight);

  // scale = 2n/g ⇒ dims = (w/g)·2n × (h/g)·2n. The aspect units w/g, h/g are
  // coprime, so at least one is odd — the factor 2 keeps both dims even.
  const ideal = (requestedScale * g) / 2;
  const maxDeviation = requestedScale * 0.1;

  let best: SnappedRenderScale | null = null;
  let bestDeviation = Infinity;
  for (const n of [Math.floor(ideal), Math.ceil(ideal)]) {
    if (n < 1) continue;
    const candidate = isValid((2 * n) / g);
    if (!candidate) continue;
    const deviation = Math.abs(candidate.scale - requestedScale);
    if (deviation <= maxDeviation && deviation < bestDeviation) {
      best = candidate;
      bestDeviation = deviation;
    }
  }

  return best;
}
