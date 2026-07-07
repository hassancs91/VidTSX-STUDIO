/**
 * Virtual modules for React and Remotion
 *
 * These modules re-export from window globals that are set up by the renderer.
 * This allows dynamically imported user code to use the same React/Remotion
 * instances as the main app.
 *
 * In the renderer, before loading any user modules:
 *   window.__VIDTSX_REACT__ = React;
 *   window.__VIDTSX_REMOTION__ = require('remotion');
 */

/**
 * Generate the virtual React module
 */
export function getVirtualReactModule(): string {
  return `
// Virtual React module - re-exports from window global
const React = window.__VIDTSX_REACT__;

if (!React) {
  throw new Error('React not available. Ensure window.__VIDTSX_REACT__ is set before importing user modules.');
}

// Default export — Proxy-wrapped so any property access falls through to the
// real React object even if it's not in the explicit named-exports list below.
// This future-proofs against React adding new hooks/utilities we haven't
// enumerated yet (vendor bundles often do \`React.someNewHook\`).
export default new Proxy(React, {
  get(target, prop) { return target[prop]; },
});

// Named exports. Kept exhaustive enough to satisfy static ESM imports from
// vendor bundles (\`import { use, forwardRef } from 'react'\`). Covers React 18
// + React 19 surface. If a vendor bundle needs something not in this list,
// add it here AND it'll still be reachable via the default Proxy export.
export const {
  // React 18 core
  Children,
  Component,
  Fragment,
  Profiler,
  PureComponent,
  StrictMode,
  Suspense,
  cloneElement,
  createContext,
  createElement,
  createFactory,
  createRef,
  forwardRef,
  isValidElement,
  lazy,
  memo,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,

  // React 19 additions
  use,
  useActionState,
  useOptimistic,
  useFormState,
  useEffectEvent,
  act,
} = React;
`;
}

/**
 * Generate the virtual React JSX runtime module
 */
export function getVirtualReactJsxRuntime(): string {
  return `
// Virtual React JSX runtime - re-exports from window global
const jsxRuntime = window.__VIDTSX_JSX_RUNTIME__;

if (!jsxRuntime) {
  throw new Error('React JSX runtime not available. Ensure window.__VIDTSX_JSX_RUNTIME__ is set.');
}

console.log('[VirtualJsx] JSX runtime available:', !!jsxRuntime, 'jsx:', typeof jsxRuntime.jsx, 'jsxs:', typeof jsxRuntime.jsxs);

// Wrap jsx functions with debugging
const _jsx = jsxRuntime.jsx;
const _jsxs = jsxRuntime.jsxs;

export const jsx = function(type, props, key) {
  try {
    return _jsx(type, props, key);
  } catch (e) {
    console.error('[VirtualJsx] jsx error:', e, 'type:', type);
    throw e;
  }
};

export const jsxs = function(type, props, key) {
  try {
    return _jsxs(type, props, key);
  } catch (e) {
    console.error('[VirtualJsx] jsxs error:', e, 'type:', type);
    throw e;
  }
};

export const { Fragment } = jsxRuntime;
// jsxDEV only exists in development mode, fallback to jsx in production
export const jsxDEV = jsxRuntime.jsxDEV || jsx;

export default jsxRuntime;
`;
}

/**
 * Generate the virtual React DOM module
 */
export function getVirtualReactDomModule(): string {
  return `
// Virtual React DOM module - re-exports from window global
const ReactDOM = window.__VIDTSX_REACT_DOM__;

if (!ReactDOM) {
  throw new Error('ReactDOM not available. Ensure window.__VIDTSX_REACT_DOM__ is set.');
}

export default ReactDOM;

export const {
  createPortal,
  flushSync,
  render,
  hydrate,
  createRoot,
  hydrateRoot,
} = ReactDOM;
`;
}

/**
 * Generate the virtual Remotion module
 */
export function getVirtualRemotionModule(): string {
  return `
// Virtual Remotion module - re-exports from window global
const Remotion = window.__VIDTSX_REMOTION__;

if (!Remotion) {
  throw new Error('Remotion not available. Ensure window.__VIDTSX_REMOTION__ is set before importing user modules.');
}

console.log('[VirtualRemotion] Module loaded, Remotion available:', !!Remotion);

// Wrap hooks with debugging
const _useCurrentFrame = Remotion.useCurrentFrame;
export const useCurrentFrame = function(...args) {
  console.log('[VirtualRemotion] useCurrentFrame called');
  try {
    const result = _useCurrentFrame.apply(this, args);
    console.log('[VirtualRemotion] useCurrentFrame returned:', result);
    return result;
  } catch (e) {
    console.error('[VirtualRemotion] useCurrentFrame error:', e);
    throw e;
  }
};

const _useVideoConfig = Remotion.useVideoConfig;
export const useVideoConfig = function(...args) {
  console.log('[VirtualRemotion] useVideoConfig called');
  try {
    const result = _useVideoConfig.apply(this, args);
    console.log('[VirtualRemotion] useVideoConfig returned:', result);
    return result;
  } catch (e) {
    console.error('[VirtualRemotion] useVideoConfig error:', e);
    throw e;
  }
};

// Wrap spring with debugging
const _spring = Remotion.spring;
console.log('[VirtualRemotion] spring function available:', typeof _spring);
export const spring = function(...args) {
  console.log('[VirtualRemotion] spring called with:', args);
  try {
    const result = _spring.apply(this, args);
    console.log('[VirtualRemotion] spring returned:', result);
    return result;
  } catch (e) {
    console.error('[VirtualRemotion] spring error:', e);
    throw e;
  }
};

// Wrap interpolate with debugging
const _interpolate = Remotion.interpolate;
console.log('[VirtualRemotion] interpolate function available:', typeof _interpolate);
export const interpolate = function(...args) {
  try {
    return _interpolate.apply(this, args);
  } catch (e) {
    console.error('[VirtualRemotion] interpolate error:', e, 'args:', args);
    throw e;
  }
};

// Log all available exports for debugging
console.log('[VirtualRemotion] Available exports:', Object.keys(Remotion).slice(0, 20));
console.log('[VirtualRemotion] AbsoluteFill:', typeof Remotion.AbsoluteFill);
console.log('[VirtualRemotion] Easing:', typeof Remotion.Easing);

// Re-export other Remotion exports directly
export const {
  useCurrentScale,

  // Components
  AbsoluteFill,
  Audio,
  Composition,
  Freeze,
  Img,
  IFrame,
  Loop,
  OffthreadVideo,
  Sequence,
  Series,
  Static,
  Still,
  Video,

  // Utilities
  cancelRender,
  continueRender,
  delayRender,
  getInputProps,
  getRemotionEnvironment,
  interpolateColors,
  measureSpring,
  random,

  // Easing
  Easing,

  // Configuration
  Config,

  // Internals (needed by @remotion/three and other Remotion packages)
  Internals,

  // Hooks used by @remotion/three
  useDelayRender,
  useRemotionEnvironment,

  // Types (these won't actually export but TypeScript expects them)
  VERSION,
} = Remotion;

// Custom staticFile override — routes local file paths through the module server's
// /asset endpoint so they resolve in the browser preview context.
// The real Remotion staticFile points to a public/ dir that doesn't exist in Creator.
export const staticFile = function(filePath) {
  const base = window.__VIDTSX_MODULE_SERVER_URL__ || 'http://127.0.0.1:3200';
  return base + '/asset?path=' + encodeURIComponent(filePath);
};

// Default export for import * as Remotion
export default Remotion;
`;
}

/**
 * Virtual `@remotion/three` shim that wraps `ThreeCanvas` so async children
 * (drei <Text> with a remote font, suspending textures, etc.) can't blank
 * the whole scene.
 *
 * Background: @remotion/three's `ThreeCanvas` puts a single Suspense boundary
 * around all children. When any child suspends — most commonly drei <Text>
 * while it fetches its `font` URL and builds an SDF in a Worker — the entire
 * scene tree is replaced by the Suspense fallback (null), so siblings like
 * lights, meshes, and overlays disappear too. By inserting our own
 * `<Suspense fallback={null}>` around just the user's children, suspensions
 * stay scoped to the suspending element while the rest of the scene renders
 * immediately.
 *
 * This module re-exports everything else from the vendor bundle untouched —
 * ESM lets the local `ThreeCanvas` export shadow the `export *` re-export.
 */
export function getVirtualRemotionThreeModule(): string {
  // Enumerate the non-ThreeCanvas exports explicitly. If @remotion/three adds
  // a new export later, extend this list. Explicit re-exports avoid any
  // browser-level ambiguity between a local export and `export *`.
  return `
import { ThreeCanvas as __OriginalThreeCanvas } from '/vendor/remotion-three.js';
import { Suspense, createElement } from '/virtual/react.js';

export { useVideoTexture, useOffthreadVideoTexture } from '/vendor/remotion-three.js';

export const ThreeCanvas = function ThreeCanvas(props) {
  const { children, ...rest } = props;
  return createElement(
    __OriginalThreeCanvas,
    rest,
    createElement(Suspense, { fallback: null }, children)
  );
};
`;
}

/**
 * Generate the virtual Remotion no-react module
 * This is the 'remotion/no-react' entry point used by @remotion/three
 */
export function getVirtualRemotionNoReactModule(): string {
  return `
// Virtual remotion/no-react module - re-exports from window global
const RemotionNoReact = window.__VIDTSX_REMOTION_NO_REACT__;

if (!RemotionNoReact) {
  throw new Error('Remotion no-react not available. Ensure window.__VIDTSX_REMOTION_NO_REACT__ is set.');
}

export const { NoReactInternals, interpolate, random } = RemotionNoReact;
export default RemotionNoReact;
`;
}
