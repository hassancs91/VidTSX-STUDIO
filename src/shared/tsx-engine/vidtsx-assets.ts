// `@vidtsx/assets`: loading a builder piece's files so that every rendered frame
// already shows them (TSX_BUILDER_DESIGN.md P2 part 4).
//
// Remotion takes a frame's screenshot as soon as no delayRender handle is
// open. A file fetched in an effect and put in state therefore arrives one
// commit too late unless a handle is held until the commit that SHOWS it. The
// hooks here hold one per component from its first render until that commit
// (and, through `settle`, until a WebGL canvas has drawn it: @vidtsx/three-assets),
// and each file is fetched once per page, so out-of-order frames and the
// in-order preview share one load and draw the same pixels.
//
// The bundle step (main/services/studio/shot-bundle.ts) inlines this file
// wherever an artifact imports '@vidtsx/assets'. It imports only react and
// remotion (the artifact's externals). The URL comes from the piece's
// staticFile call, which the bundle step maps to its `assets` prop.
//
// Never write the staticFile call itself (name, parenthesis, quoted string)
// anywhere in this file or @vidtsx/three-assets, comments included: the bundle
// step reads every such literal in the bundled text as a file the piece loads.

import { useEffect, useReducer, useRef } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';

interface Entry {
  done: boolean;
  value?: unknown;
  error?: Error;
  waiters: Set<() => void>;
}

/** One load per kind of read and URL, kept for the page's life. */
const cache = new Map<string, Entry>();

function entryFor(cacheKey: string, label: string, load: () => Promise<unknown>): Entry {
  const found = cache.get(cacheKey);
  if (found) return found;
  const entry: Entry = { done: false, waiters: new Set() };
  cache.set(cacheKey, entry);
  Promise.resolve()
    .then(load)
    .then(
      (value) => {
        entry.value = value;
      },
      (err: unknown) => {
        entry.error = new Error(`${label} could not be loaded: ${err instanceof Error ? err.message : String(err)}`);
        cancelRender(entry.error);
      },
    )
    .finally(() => {
      entry.done = true;
      for (const wake of entry.waiters) wake();
    });
  return entry;
}

/**
 * The low-level hook the others build on: `load` runs once per page for
 * `cacheKey`; the value is null until it has arrived, and the frame waits for
 * it. `settle(done)` runs after the commit that shows the value; call `done`
 * when it has been drawn (the default calls it at once).
 */
export function useLoaded<T>(
  cacheKey: string,
  label: string,
  load: () => Promise<T>,
  settle?: (done: () => void) => void,
): T | null {
  const entry = entryFor(cacheKey, label, load);
  const [, wake] = useReducer((n: number) => n + 1, 0);
  // A handle for each key this component rendered before its file arrived.
  const handles = useRef(new Map<string, number>());
  if (!entry.done && !handles.current.has(cacheKey)) {
    handles.current.set(cacheKey, delayRender(`@vidtsx/assets: ${label}`, { timeoutInMilliseconds: 120_000 }));
  }
  const done = entry.done;
  useEffect(() => {
    // This render already showed the file.
    if (done) return undefined;
    // It arrived after this render and before this effect (the waiters were
    // already called): render again, or the frame waits forever (a contact
    // sheet's later tiles hit this in P2 part 4's probe).
    if (entry.done) {
      wake();
      return undefined;
    }
    const waiter = () => wake();
    entry.waiters.add(waiter);
    return () => {
      entry.waiters.delete(waiter);
    };
  }, [entry, done]);
  useEffect(() => {
    // A handle taken for a URL this component no longer loads (its assets prop changed) is let go.
    for (const [key, stale] of handles.current) {
      if (key === cacheKey) continue;
      handles.current.delete(key);
      continueRender(stale);
    }
    if (!done) return;
    const handle = handles.current.get(cacheKey);
    if (handle === undefined) return;
    handles.current.delete(cacheKey);
    // A failed load already cancelled the render.
    if (entry.error) return;
    if (settle) settle(() => continueRender(handle));
    else continueRender(handle);
    // `settle` is read once per arrival on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, cacheKey, entry]);
  useEffect(
    () => () => {
      for (const handle of handles.current.values()) continueRender(handle);
      handles.current.clear();
    },
    [],
  );
  if (entry.error) throw entry.error;
  return done ? (entry.value as T) : null;
}

/** Throws a named error for '' (a staticFile name the piece's assets prop lacks). */
export function requireUrl(url: string, what: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error(`${what}: the URL is empty, so the file is not in this piece's assets (a staticFile name with no file in assets/).`);
  }
  return url;
}

async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** A JSON file (a Lottie animation, data), parsed. */
export function useJson<T = unknown>(url: string): T | null {
  requireUrl(url, 'useJson');
  return useLoaded<T>(`json\n${url}`, url, async () => (await fetchOk(url)).json() as Promise<T>);
}

/** A text file (CSV, plain text). */
export function useText(url: string): string | null {
  requireUrl(url, 'useText');
  return useLoaded(`text\n${url}`, url, async () => (await fetchOk(url)).text());
}

/** A file's bytes (a font for opentype.parse, a binary table). */
export function useArrayBuffer(url: string): ArrayBuffer | null {
  requireUrl(url, 'useArrayBuffer');
  return useLoaded(`bytes\n${url}`, url, async () => (await fetchOk(url)).arrayBuffer());
}

/** A decoded image, for drawing on a canvas (an <Img> from remotion needs none of this). */
export function useImage(url: string): HTMLImageElement | null {
  requireUrl(url, 'useImage');
  return useLoaded(`image\n${url}`, url, async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    return img;
  });
}
