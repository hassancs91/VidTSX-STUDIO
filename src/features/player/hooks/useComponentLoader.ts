import { useState, useCallback, useRef, useEffect } from 'react';
import { createRendererLogger } from '../../../renderer/utils/logger';

const log = createRendererLogger('ComponentLoader');
import type { ComponentType } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import * as Remotion from 'remotion';
import * as RemotionNoReact from 'remotion/no-react';

export interface CompositionConfig {
  id: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}

export type LoaderStatus = 'idle' | 'loading' | 'success' | 'error';

export interface LoaderState {
  status: LoaderStatus;
  moduleUrl: string | null;
  config: CompositionConfig | null;
  error: string | null;
  errorLocation?: {
    line: number;
    column: number;
    file: string;
  };
}

export interface UseComponentLoaderResult {
  state: LoaderState;
  loadComponent: (filePath: string) => Promise<void>;
  lazyComponent: (() => Promise<{ default: ComponentType<unknown> }>) | null;
  reset: () => void;
}

const initialState: LoaderState = {
  status: 'idle',
  moduleUrl: null,
  config: null,
  error: null,
};

/**
 * Hook for loading user TSX compositions as native React components
 *
 * Usage:
 * ```tsx
 * const { state, loadComponent, lazyComponent } = useComponentLoader();
 *
 * useEffect(() => {
 *   loadComponent('/path/to/composition.tsx');
 * }, []);
 *
 * if (state.status === 'success' && lazyComponent && state.config) {
 *   return (
 *     <Player
 *       lazyComponent={lazyComponent}
 *       durationInFrames={state.config.durationInFrames}
 *       fps={state.config.fps}
 *       compositionWidth={state.config.width}
 *       compositionHeight={state.config.height}
 *     />
 *   );
 * }
 * ```
 */
export function useComponentLoader(): UseComponentLoaderResult {
  const [state, setState] = useState<LoaderState>(initialState);
  const currentFileRef = useRef<string | null>(null);

  // Create the lazyComponent function when we have a module URL
  // Wrapped with timeout and error handling to prevent silent failures
  const lazyComponent = state.moduleUrl
    ? () => {
        // Add timestamp to bust browser's dynamic import cache
        const moduleUrl = `${state.moduleUrl}?t=${Date.now()}`;
        log.debug('Starting dynamic import', { moduleUrl });

        return new Promise<{ default: ComponentType<unknown> }>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            log.error('Import timed out after 10s', new Error('Module import timed out'), { moduleUrl });
            reject(new Error('Module import timed out after 10 seconds'));
          }, 10000);

          import(/* @vite-ignore */ moduleUrl)
            .then((module) => {
              clearTimeout(timeoutId);
              log.debug('Import successful');
              resolve(module as { default: ComponentType<unknown> });
            })
            .catch((err) => {
              clearTimeout(timeoutId);
              log.error('Import failed', err);
              reject(err);
            });
        });
      }
    : null;

  const loadComponent = useCallback(async (filePath: string) => {
    // Track current file to handle race conditions
    currentFileRef.current = filePath;

    setState({
      status: 'loading',
      moduleUrl: null,
      config: null,
      error: null,
    });

    try {
      const result = await window.api.moduleTranspile({ filePath });

      // Check if this is still the current file
      if (currentFileRef.current !== filePath) {
        return;
      }

      if (!result.success) {
        setState({
          status: 'error',
          moduleUrl: null,
          config: null,
          error: result.error ?? 'Unknown transpilation error',
          errorLocation: result.errorLocation,
        });
        return;
      }

      setState({
        status: 'success',
        moduleUrl: result.moduleUrl ?? null,
        config: result.compositionConfig ?? null,
        error: null,
      });
    } catch (err) {
      // Check if this is still the current file
      if (currentFileRef.current !== filePath) {
        return;
      }

      setState({
        status: 'error',
        moduleUrl: null,
        config: null,
        error: err instanceof Error ? err.message : 'Failed to load component',
      });
    }
  }, []);

  const reset = useCallback(() => {
    currentFileRef.current = null;
    setState(initialState);
  }, []);

  return {
    state,
    loadComponent,
    lazyComponent,
    reset,
  };
}

/**
 * Setup global references for virtual modules
 *
 * Uses STATIC imports to ensure the same module instances are used
 * as the Remotion Player component. This is critical for React context
 * to work correctly with hooks like useCurrentFrame().
 *
 * Also fetches the module server URL so the virtual staticFile() can
 * route local file paths through the /asset endpoint.
 *
 * This must be called BEFORE loading any user modules.
 * Call this once in your app's entry point.
 */
export async function setupVirtualModuleGlobals(): Promise<void> {
  // Use static imports (defined at top of file) to ensure same module instances
  // as the Player component. Dynamic imports can return different instances.
  const globals = window as unknown as Record<string, unknown>;
  globals.__VIDTSX_REACT__ = React;
  globals.__VIDTSX_REACT_DOM__ = ReactDOM;
  globals.__VIDTSX_JSX_RUNTIME__ = jsxRuntime;
  globals.__VIDTSX_REMOTION__ = Remotion;
  globals.__VIDTSX_REMOTION_NO_REACT__ = RemotionNoReact;

  // Fetch module server URL for staticFile() to route through /asset endpoint
  try {
    const res = await window.api.moduleServerUrl();
    if (res.url) {
      globals.__VIDTSX_MODULE_SERVER_URL__ = res.url;
      log.debug('Module server URL set', { url: res.url });
    }
  } catch {
    log.warn('Failed to fetch module server URL, staticFile() will use fallback');
  }

  log.debug('Virtual module globals set up with static imports');
}
