// The subject-mask reader (docs/studio/FILTER_PACKS_DESIGN.md "As built
// (masks track)" → M2): an index (mask-track.ts) + a way to read byte ranges
// of the blobs → the decoded 8-bit mask at a source time, synchronously when
// it is already decoded (a paint is synchronous), else null while a window
// of frames around it loads. The composition gets a reader in `tracks.masks`:
//
//   Player      bytes over IPC (`studioAnalysisReadMask`: a bounded range of
//               the asset's own blob file, the path built in main) — the
//               Player's asset server (the module server) answers ANY origin
//               with `Access-Control-Allow-Origin: *`, so serving `.bin` there
//               would widen what a web page could read off this machine;
//   render host bytes from the asset server by HTTP Range — the bundle is
//               served from that very origin (`httpRangeFetcher`).
//
// A window is WINDOW consecutive frames; its blobs are read in as few ranges
// as they are contiguous in the bin (one per analysis run), inflated one by
// one with `DecompressionStream('deflate')` (each blob is its own zlib
// stream), and kept in a small LRU. Reaching the second half of a window
// prefetches the next, so playback stays ahead. A blob that fails to read or
// inflate is "no mask" at that frame: the clip plays plain there.
//
// No DOM, no Node: fetch, Blob, Response and DecompressionStream exist in
// both the browser and Node ≥ 18 (the tests run it in Node).

import { maskEntryIndexAt, type MaskTrackIndex } from './mask-track';

/** Reads `length` bytes of the blob file starting at `offset`. */
export type MaskRangeFetcher = (offset: number, length: number) => Promise<Uint8Array>;

export interface DecodedMask {
  /** `width × height` alpha, 0 = background, 255 = subject. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** The stored frame's source seconds (the lookup matched it within half a frame). */
  t: number;
}

export interface MaskReader {
  readonly index: MaskTrackIndex;
  /** The decoded mask at a source time, or null — not decoded yet (a load starts) or no frame there. */
  maskAt(time: number): DecodedMask | null;
  /** 'none': no frame at this time (a gap, a failed blob); 'ready': decoded; 'pending': not yet. */
  state(time: number): 'none' | 'ready' | 'pending';
  /** Settles (never rejects) when the frame at `time` is decoded or known to be missing. */
  load(time: number): Promise<void>;
  /** Called after each window lands; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Frames per read: 2 s at 24 fps, ~0.25–0.5 MB of blobs. */
export const MASK_WINDOW = 48;
/** Decoded frames kept (≈ 13 MB at 256×144). */
export const MASK_CACHE_FRAMES = 360;

/** One zlib stream → its bytes. */
export async function inflateMask(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Byte ranges from the asset server: a 206 is the range, a 200 (a server without ranges) is sliced. */
export function httpRangeFetcher(url: string): MaskRangeFetcher {
  return async (offset, length) => {
    const res = await fetch(url, { headers: { Range: `bytes=${offset}-${offset + length - 1}` } });
    if (!res.ok) throw new Error(`Mask read failed: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const out = res.status === 206 ? bytes : bytes.subarray(offset, offset + length);
    if (out.length !== length) throw new Error(`Mask read came back short: ${out.length} of ${length} bytes`);
    return out;
  };
}

export function createMaskReader(index: MaskTrackIndex, fetchRange: MaskRangeFetcher): MaskReader {
  const frames = index.frames;
  const pixels = index.mask.width * index.mask.height;
  const decoded = new Map<number, Uint8ClampedArray>();
  const failed = new Set<number>();
  const windows = new Map<number, Promise<void>>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      try {
        listener();
      } catch {
        // A painter that throws must not stop the others.
      }
    }
  };

  const remember = (i: number, data: Uint8ClampedArray) => {
    decoded.delete(i);
    decoded.set(i, data);
    while (decoded.size > MASK_CACHE_FRAMES) decoded.delete(decoded.keys().next().value as number);
  };

  async function readWindow(w: number): Promise<void> {
    const first = w * MASK_WINDOW;
    const last = Math.min(frames.length, first + MASK_WINDOW);
    const todo: number[] = [];
    for (let i = first; i < last; i++) if (!decoded.has(i) && !failed.has(i)) todo.push(i);
    // Contiguous blobs (one run's frames, in time order) → one read each.
    const groups: number[][] = [];
    for (const i of todo) {
      const group = groups[groups.length - 1];
      const prev = group?.[group.length - 1];
      if (group && prev !== undefined && frames[prev][1] + frames[prev][2] === frames[i][1]) group.push(i);
      else groups.push([i]);
    }
    await Promise.all(
      groups.map(async (group) => {
        const start = frames[group[0]][1];
        const end = frames[group[group.length - 1]][1] + frames[group[group.length - 1]][2];
        let bytes: Uint8Array;
        try {
          bytes = await fetchRange(start, end - start);
        } catch {
          for (const i of group) failed.add(i);
          return;
        }
        for (const i of group) {
          try {
            const [, offset, length] = frames[i];
            const raw = await inflateMask(bytes.subarray(offset - start, offset - start + length));
            if (raw.length !== pixels) throw new Error('size');
            remember(i, new Uint8ClampedArray(raw.buffer, raw.byteOffset, raw.length));
          } catch {
            failed.add(i);
          }
        }
      }),
    );
  }

  function ensureWindow(w: number): Promise<void> {
    if (w < 0 || w * MASK_WINDOW >= frames.length) return Promise.resolve();
    let pending = windows.get(w);
    if (!pending) {
      pending = readWindow(w)
        .catch(() => {})
        .finally(() => {
          windows.delete(w);
          notify();
        });
      windows.set(w, pending);
    }
    return pending;
  }

  /** The window holding frame `i`, plus the next one once `i` is in the second half (playback). */
  function request(i: number): Promise<void> {
    const w = Math.floor(i / MASK_WINDOW);
    if (i % MASK_WINDOW >= MASK_WINDOW / 2) {
      const next = w + 1;
      const firstOfNext = next * MASK_WINDOW;
      if (firstOfNext < frames.length && !decoded.has(firstOfNext) && !failed.has(firstOfNext)) void ensureWindow(next);
    }
    return decoded.has(i) || failed.has(i) ? Promise.resolve() : ensureWindow(w);
  }

  return {
    index,
    maskAt(time) {
      const i = maskEntryIndexAt(index, time);
      if (i < 0) return null;
      void request(i);
      const data = decoded.get(i);
      if (!data) return null;
      remember(i, data);
      return { data, width: index.mask.width, height: index.mask.height, t: frames[i][0] };
    },
    state(time) {
      const i = maskEntryIndexAt(index, time);
      if (i < 0 || failed.has(i)) return 'none';
      return decoded.has(i) ? 'ready' : 'pending';
    },
    async load(time) {
      const i = maskEntryIndexAt(index, time);
      if (i >= 0) await request(i);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
