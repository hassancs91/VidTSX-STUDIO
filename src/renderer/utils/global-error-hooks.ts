import { createRendererLogger } from './logger';

const log = createRendererLogger('global');

let installed = false;

/**
 * Forward uncaught renderer errors into the main-process log engine (and from
 * there to opt-in crash reporting). Called once from main.tsx.
 */
export function installGlobalErrorHooks(): void {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (event) => {
    log.error('Uncaught error', event.error ?? event.message, {
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    log.error('Unhandled promise rejection', event.reason);
  });
}
