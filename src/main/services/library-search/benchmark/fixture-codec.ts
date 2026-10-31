// The benchmark fixture's vector codec (LIBRARY_SEARCH_DESIGN.md §9.1): each vector is stored as signed integers
// scaled per vector (scale = max |x| / the type's max), base64. `scripts/library-search-fixture.mjs` picks the
// precision — int8 when it reproduces S1's float32 table, else int16 — and records the check in the file.

export type FixturePrecision = 'int8' | 'int16';

export interface EncodedVector {
  /** Per-vector scale: x ≈ q × s. */
  s: number;
  /** base64 of the Int8 / Int16 (little-endian) components. */
  v: string;
}

const MAX: Record<FixturePrecision, number> = { int8: 127, int16: 32767 };

export function encodeVector(x: ArrayLike<number>, precision: FixturePrecision): EncodedVector {
  let peak = 0;
  for (let i = 0; i < x.length; i += 1) peak = Math.max(peak, Math.abs(x[i]));
  const s = peak > 0 ? peak / MAX[precision] : 1;
  const q = precision === 'int8' ? new Int8Array(x.length) : new Int16Array(x.length);
  for (let i = 0; i < x.length; i += 1) q[i] = Math.round(x[i] / s);
  return { s, v: Buffer.from(q.buffer, q.byteOffset, q.byteLength).toString('base64') };
}

export function decodeVector(e: EncodedVector, precision: FixturePrecision): Float32Array {
  // Copied into a fresh buffer: a pooled Buffer slice can sit at an odd offset (no Int16Array view on it).
  const bytes = Uint8Array.from(Buffer.from(e.v, 'base64'));
  const q = precision === 'int8' ? new Int8Array(bytes.buffer) : new Int16Array(bytes.buffer);
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i += 1) out[i] = q[i] * e.s;
  return out;
}

/** Cosine in float64 (the decoded vectors are no longer exactly unit length). */
export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na > 0 && nb > 0 ? dot / Math.sqrt(na * nb) : 0;
}
