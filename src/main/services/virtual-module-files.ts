// Which bare specifiers the preview serves from the module server's virtual
// modules (the Player's own React / ReactDOM / Remotion instances) instead of
// the CDN. A shot that imported one of these from esm.sh would get a second
// copy — a second React breaks hooks, a second remotion/no-react resets
// `window.remotion_delayRenderHandles` (END_TO_END_PLAN T7).

/** Specifier → file under `<moduleServer>/virtual/`. */
const VIRTUAL_MODULE_FILES: Readonly<Record<string, string>> = {
  react: 'react.js',
  'react-dom': 'react-dom.js',
  'react/jsx-runtime': 'react-jsx-runtime.js',
  'react/jsx-dev-runtime': 'react-jsx-runtime.js',
  remotion: 'remotion.js',
  // remotion's own subpaths (shot-lint REMOTION_SUBPATHS): the routes esm.sh
  // already asks for when it appends a subpath to the `remotion` alias.
  'remotion/no-react': 'remotion.js/no-react',
  'remotion/version': 'remotion.js/version',
};

/** The virtual file serving `specifier`, or undefined when it is not a shared instance. */
export function virtualModuleFile(specifier: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(VIRTUAL_MODULE_FILES, specifier)
    ? VIRTUAL_MODULE_FILES[specifier]
    : undefined;
}
