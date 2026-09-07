// What THIS build knows, packaged as the deps the package reader takes.
//
// Separate from `agent-package.ts` on purpose. This file reaches the live app —
// `app.getVersion()`, the tool registry (which transitively pulls the image and
// video engines), and the TSX gate (which reaches the module server and
// esbuild) — while `agent-package.ts` stays a pure function of its deps, so the
// package rules can be unit-tested without standing an app up.
//
// Reading this file is also the shortest answer to "what does the validator
// check a manifest against": the app version, the registered tool ids, and the
// two kind registries.

import { app } from 'electron';
import { ARTIFACT_KINDS, INTERACTION_KINDS } from '../../../shared/types/agents';
import type { ManifestContext } from '../../../shared/agents/manifest';
import { listToolIds } from './tools/registry';
import { validateAgentCompositionCode } from './tsx-deps';
import type { AgentPackageDeps } from './agent-package';

export function buildManifestContext(): ManifestContext {
  return {
    appVersion: app.getVersion(),
    toolIds: listToolIds(),
    artifactKinds: ARTIFACT_KINDS,
    interactionKinds: INTERACTION_KINDS,
  };
}

/** The deps every install, scan and inspect in the running app uses. */
export function buildAgentPackageDeps(): AgentPackageDeps {
  return {
    manifestContext: buildManifestContext(),
    validateComposition: validateAgentCompositionCode,
  };
}
