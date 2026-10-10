// Shared constants of the TSX builder. Kept free of imports so the store and
// its tests do not pull in the bundler chain that build-check needs.

/** The entry file of a build folder; `check` bundles from here. */
export const BUILD_ENTRY = 'index.tsx';
