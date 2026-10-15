// Shared constants of the TSX builder. Kept free of imports so the store and
// its tests do not pull in the bundler chain that build-check needs.

/** The entry file of a build folder; `check` bundles from here. */
export const BUILD_ENTRY = 'index.tsx';

/** The build folder's files (staticFile() names a path inside it); saved as `vN.assets/`. */
export const ASSETS_DIR = 'assets';

/** An edit's hand changes to carry over (build-seed.ts); read once, never saved into `vN.src/`. */
export const HAND_EDITS_FILE = 'HAND-EDITS.diff';
