// Vite's `?raw` suffix: the file's text as a string, embedded in the main
// bundle at build time (vitest resolves it the same way). The bundle step uses
// it to ship app-provided modules inside artifacts (shot-bundle.ts), so they
// need no file on disk next to a packaged app.
declare module '*?raw' {
  const source: string;
  export default source;
}
