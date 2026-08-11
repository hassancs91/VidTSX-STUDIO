/**
 * Wrap an IPC handler so a lazy engine initializer completes before the
 * handler runs. Startup no longer initializes local AI engines — no native
 * addons, GPU probes, or model-folder scans until first use (see
 * V1_RELEASE_PLAN.md Phase B) — so the first IPC call that needs an engine
 * pays its memoized init cost here instead.
 */
export function lazily<Args extends unknown[], Result>(
  ensure: () => Promise<void>,
  handler: (...args: Args) => Result | Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args) => {
    await ensure();
    return handler(...args);
  };
}
