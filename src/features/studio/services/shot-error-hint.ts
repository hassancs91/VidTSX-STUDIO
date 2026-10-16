// What a crashed shot's placeholder says when the raw error has a known cause
// (TSX_BUILDER_DESIGN.md P3 part 6, D9).
//
// A builder shot made with three / React Three Fiber carries R3F's production
// reconciler inside its one file. Under `npm run dev` the editor runs
// development React, and that reconciler fails on its first render with
// "dispatcher.getOwner is not a function". The packaged app runs production
// React and plays it; in dev, VIDTSX_DEV_PROD_REACT=1 switches the renderer to
// production React (electron.vite.config.mjs).
//
// That error is thrown inside R3F's own reconciler root, so it never reaches
// the shot's error boundary: it surfaces as an uncaught window error whose
// stack names the shot's module URL. `windowErrorHint` lets the boundary claim
// it (live check L0a, 10-15: without it the canvas just stays blank).

const PROD_REACT_NEEDED = /\bgetOwner is not a function\b/;

export const PROD_REACT_HINT =
  'This 3D shot needs production React under npm run dev: start with VIDTSX_DEV_PROD_REACT=1. A packaged app plays it.';

/** The sentence to show instead of `message`, or null when the error has no known cause. */
export function shotErrorHint(message: string): string | null {
  return PROD_REACT_NEEDED.test(message) ? PROD_REACT_HINT : null;
}

/**
 * The message of an uncaught window error that belongs to the shot served at
 * `moduleUrl` and has a known cause, else null (every other error is left to
 * the page, as before).
 */
export function windowErrorHint(error: unknown, moduleUrl: string): string | null {
  if (!(error instanceof Error) || !moduleUrl) return null;
  if (!(error.stack ?? '').includes(moduleUrl)) return null;
  return shotErrorHint(error.message) ? error.message : null;
}
