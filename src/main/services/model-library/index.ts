/**
 * Barrel for the category-agnostic model-library core (main process).
 *
 * Every module here is free of `electron` and settings-db imports — paths and
 * persistence are injected. Thin wiring that reads `app.getPath`/settings lives
 * outside this folder (phase 2, the image adapter).
 */
export * from './scanner';
export * from './classifier';
export * from './sidecars';
export * from './importer';
export * from './usage-store';
export * from './category-registry';
export * from './runtime-registry';
