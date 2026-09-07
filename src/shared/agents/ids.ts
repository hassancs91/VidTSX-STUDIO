// Agent ids — `<namespace>/<name>`, both segments `[a-z0-9-]+`.
//
// The id is the only user-supplied string that ever becomes a folder name, so
// it is parsed once here and every path is built from the PARSED segments
// (agents plan §1.1, §1.6). Nothing downstream may split the raw string.

/** One id segment: lowercase letters, digits and hyphens. */
export const AGENT_ID_SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Both segments together are capped so a path stays comfortably short. */
export const AGENT_ID_SEGMENT_MAX = 64;

export interface AgentIdParts {
  namespace: string;
  name: string;
}

/** `null` when the id is not `<namespace>/<name>` with both segments legal. */
export function parseAgentId(raw: unknown): AgentIdParts | null {
  if (typeof raw !== 'string') return null;
  const parts = raw.split('/');
  if (parts.length !== 2) return null;
  const [namespace, name] = parts;
  for (const segment of parts) {
    if (segment.length === 0 || segment.length > AGENT_ID_SEGMENT_MAX) return null;
    if (!AGENT_ID_SEGMENT_RE.test(segment)) return null;
  }
  return { namespace, name };
}

/** Throwing form, for callers that already validated upstream. */
export function assertAgentId(raw: unknown): AgentIdParts {
  const parsed = parseAgentId(raw);
  if (!parsed) {
    throw new Error(
      `Invalid agent id ${JSON.stringify(raw)} — expected "<namespace>/<name>", each [a-z0-9-].`,
    );
  }
  return parsed;
}

/**
 * The two path segments of the INSTALL folder
 * (`<userData>/agents/<namespace>/<name>`), agents plan §1.5.
 */
export function agentDirSegments(id: string): [string, string] {
  const { namespace, name } = assertAgentId(id);
  return [namespace, name];
}

/**
 * A single flat segment for places that want one folder per agent — the
 * session root is `<userData>/agent-sessions/<namespace>.<name>/` (§1.5).
 */
export function agentDirName(id: string): string {
  const { namespace, name } = assertAgentId(id);
  return `${namespace}.${name}`;
}
