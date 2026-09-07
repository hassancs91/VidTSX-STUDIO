// "Check for update" for one installed agent (agents plan §1.6).
//
// The whole feature, and no more than the whole feature: ONE https GET, on a
// click the user made, of the `updateUrl` the manifest declared, answering one
// question — is there a newer version, and can this app run it. There is no
// background poll, no cache, no badge, and above all no download: the user
// downloads from the store and installs through the ordinary import path, which
// is what keeps licensing out of the app entirely (decision 8).
//
// Everything a feed says is untrusted. The `id` must match the agent asking,
// the URL must be https, an older-or-equal version is simply "no update", and
// any failure is one sentence the dialog shows rather than an app-level error.

import { compareAgentVersions } from '../../../shared/agents/manifest';
import type { AgentManifest, AgentUpdateInfo } from '../../../shared/types/agents';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 64 * 1024;

export class AgentUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentUpdateError';
  }
}

export interface CheckAgentUpdateOptions {
  /** The running app version, for the compatibility verdict. */
  appVersion: string;
  /** Test seam — defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Narrow an update feed body against the agent it claims to describe.
 * Returns null when the feed is well-formed but offers nothing newer.
 */
export function parseAgentUpdate(
  raw: unknown,
  manifest: AgentManifest,
  appVersion: string,
): AgentUpdateInfo | null {
  const body = asRecord(raw);
  if (!body) throw new AgentUpdateError('The update feed is not an object.');
  if (body.id !== manifest.id) {
    throw new AgentUpdateError('The update feed describes a different agent.');
  }
  const latest = asRecord(body.latest);
  if (!latest) throw new AgentUpdateError('The update feed has no "latest" block.');

  const { version, url, minAppVersion, notes } = latest;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new AgentUpdateError('The update feed has no usable version.');
  }
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new AgentUpdateError('The update feed download link is not an https URL.');
  }
  // Absent minAppVersion reads as "runs anywhere", which is the honest default
  // for a feed written before the field existed.
  const needs = typeof minAppVersion === 'string' ? minAppVersion : '0.0.0';

  if (compareAgentVersions(version, manifest.version) <= 0) return null;
  return {
    version,
    url,
    minAppVersion: needs,
    ...(typeof notes === 'string' ? { notes: notes.slice(0, 1000) } : {}),
    compatible: compareAgentVersions(needs, appVersion) <= 0,
  };
}

/**
 * Fetch and evaluate an agent's update feed. `null` = up to date, or the agent
 * declares no `updateUrl` (its card simply has no menu item).
 */
export async function checkAgentUpdate(
  manifest: AgentManifest,
  options: CheckAgentUpdateOptions,
): Promise<AgentUpdateInfo | null> {
  const { appVersion, fetchImpl = fetch } = options;
  if (!manifest.updateUrl) return null;
  // Re-checked here as well as in the manifest validator: an https-only rule
  // that lives only in the validator is one refactor away from not existing.
  if (!manifest.updateUrl.startsWith('https://')) {
    throw new AgentUpdateError('This agent’s update address is not an https URL.');
  }

  let text: string;
  try {
    const response = await fetchImpl(manifest.updateUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new AgentUpdateError(`The update server answered ${response.status}.`);
    }
    text = await response.text();
  } catch (err) {
    if (err instanceof AgentUpdateError) throw err;
    throw new AgentUpdateError('Could not reach the update server.');
  }
  if (text.length > MAX_BODY_BYTES) {
    throw new AgentUpdateError('The update feed is implausibly large.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new AgentUpdateError('The update feed is not readable JSON.');
  }
  return parseAgentUpdate(raw, manifest, appVersion);
}
