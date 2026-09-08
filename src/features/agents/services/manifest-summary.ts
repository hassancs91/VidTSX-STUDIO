// What an agent can do and how far to trust it, both read off the manifest
// (agents plan §1.7). Pure functions: the dialogs and the card call them, and
// they are the only place either rule is written down.

import type { AgentManifest, InstalledAgent } from '@shared/types/agents';
import type { AgentCapability, TrustTag } from '../types';

const UNVERIFIED_NOTICE =
  'VidTSX has not reviewed this agent. It runs with your providers and credits.';

/**
 * ONE tag per card. `origin: 'builtin'` outranks the signature: built-ins ship
 * inside the signed installer and carry no `signature.json` of their own, so
 * they read as `unsigned` on disk (Stage 2 outcome) — and labelling a shipped
 * agent "Unverified. Use at your own risk" would be both alarming and wrong.
 */
export function trustTagFor(agent: InstalledAgent): TrustTag {
  if (agent.origin === 'builtin') {
    return { label: 'Built-in', tone: 'accent' };
  }
  switch (agent.signature) {
    case 'verified':
      return { label: 'Verified by VidTSX', tone: 'accent' };
    case 'signed-unknown':
      return {
        label: 'Signed, unverified publisher',
        tone: 'warning',
        notice: UNVERIFIED_NOTICE,
      };
    case 'unsigned':
    default:
      return {
        label: 'Unverified. Use at your own risk',
        tone: 'warning',
        notice: UNVERIFIED_NOTICE,
      };
  }
}

/** Plain-words capability lines — one per capability, nothing to configure. */
export function capabilitiesFor(manifest: AgentManifest): AgentCapability[] {
  const capabilities: AgentCapability[] = [];
  const tools = new Set(manifest.tools);
  const sdkTools = new Set(manifest.sdkTools ?? []);

  if (sdkTools.has('WebSearch') || sdkTools.has('WebFetch')) {
    capabilities.push({ id: 'web', label: 'Browses the web' });
  }
  if (tools.has('write_document')) {
    capabilities.push({ id: 'documents', label: 'Writes documents you can read and save' });
  }
  if (tools.has('generate_composition') || tools.has('edit_composition')) {
    capabilities.push({ id: 'compositions', label: 'Creates animated compositions' });
  }
  if (tools.has('generate_image')) {
    capabilities.push({ id: 'images', label: 'Generates images with your image provider' });
  }
  if (tools.has('generate_video')) {
    capabilities.push({ id: 'videos', label: 'Generates video with your video provider' });
  }
  if (tools.has('render_composition')) {
    capabilities.push({ id: 'render', label: 'Renders videos through the render queue' });
  }
  if (tools.has('ask_user')) {
    capabilities.push({ id: 'ask', label: 'Asks you questions while it works' });
  }
  if (manifest.workspace?.sdkFileTools) {
    capabilities.push({ id: 'files', label: 'Writes files in its own session folder' });
  }
  if (manifest.memory?.propose) {
    capabilities.push({ id: 'memory', label: 'Proposes things to remember (you approve each)' });
  }
  return capabilities;
}
