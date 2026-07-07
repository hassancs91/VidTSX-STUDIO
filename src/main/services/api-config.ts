// The VidTSX backend is migrating hosts: the API is currently served from
// mcp.vidtsx.com and will move to vidtsx.com. To make that switch seamless we
// don't pin a single host — we resolve an ordered list of candidates and use
// the first one that actually serves the API, falling back to the next when a
// host is unreachable or not yet serving the routes. Once a host answers as the
// real API its choice is cached for the rest of the session (see vidtsxFetch).

// Known public hosts, in migration-preference order: the new home first, the
// current home as fallback. After migration, both env files point at vidtsx.com
// and the fallback simply never fires.
const PRIMARY_HOST = 'https://vidtsx.com';
const FALLBACK_HOST = 'https://mcp.vidtsx.com';
const PUBLIC_HOSTS = [PRIMARY_HOST, FALLBACK_HOST];

function envHost(): string | null {
  const url = import.meta.env.VITE_VIDTSX_API_URL ?? process.env.VITE_VIDTSX_API_URL;
  if (typeof url === 'string' && url.trim()) return url.replace(/\/$/, '');
  return null;
}

/**
 * The preferred API base URL (no trailing slash), or null when none is
 * configured. Callers that use this as a "feature enabled?" guard keep working;
 * for the actual request use vidtsxFetch so fallback hosts are tried.
 */
export function apiBaseUrl(): string | null {
  return envHost();
}

/**
 * Ordered list of host origins to try, most-preferred first.
 *
 * - env host first, so dev (mcp.vidtsx.com) and prod (vidtsx.com) each honor
 *   their configured host before any fallback.
 * - if the env host is one of the known public hosts, the other public host is
 *   appended as a fallback (this is what makes the migration seamless).
 * - a non-public override (e.g. http://localhost:8147 for local backend dev) is
 *   used on its own — we never silently fall back to production from a custom host.
 */
export function apiHostCandidates(): string[] {
  const env = envHost();
  if (!env) return [...PUBLIC_HOSTS];
  if (!PUBLIC_HOSTS.includes(env)) return [env];
  return [env, ...PUBLIC_HOSTS.filter((h) => h !== env)];
}

// Statuses that mean "this host isn't serving the API (yet)" rather than a real
// API-level error — treat them as "try the next candidate".
const HOST_UNAVAILABLE_STATUS = new Set([404, 502, 503, 504]);

// A genuine API response is JSON. vidtsx.com may currently answer unknown paths
// with its marketing site (text/html, possibly HTTP 200), so an HTML body means
// "not the API" and we should fall back rather than try to parse it as JSON.
function looksLikeApiResponse(res: Response): boolean {
  if (HOST_UNAVAILABLE_STATUS.has(res.status)) return false;
  const contentType = res.headers.get('content-type') ?? '';
  return !contentType.includes('text/html');
}

// The host that last answered as the real API. Tried first on subsequent calls
// so we don't re-probe dead hosts on every request.
let resolvedHost: string | null = null;

/**
 * fetch() against the VidTSX backend with automatic host fallback.
 *
 * `path` is the full path from the host root, e.g. '/api/v1/whoami'. Candidates
 * are tried in order until one answers as the real API; that host is then cached
 * for the session. If no host serves the API, the last "unavailable" response is
 * returned (so callers see the real status), or the last network error is thrown.
 *
 * Bodies must be replayable (string / Buffer / Blob) since a request may be sent
 * to more than one host — that's true of every current caller.
 */
export async function vidtsxFetch(path: string, init?: RequestInit): Promise<Response> {
  const candidates = apiHostCandidates();
  const order = resolvedHost
    ? [resolvedHost, ...candidates.filter((h) => h !== resolvedHost)]
    : candidates;

  let lastUnavailable: Response | null = null;
  let lastError: unknown = null;

  for (const host of order) {
    try {
      const res = await fetch(`${host}${path}`, init);
      if (looksLikeApiResponse(res)) {
        resolvedHost = host;
        return res;
      }
      lastUnavailable = res;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastUnavailable) return lastUnavailable;
  throw lastError ?? new Error('No VidTSX API host reachable');
}
