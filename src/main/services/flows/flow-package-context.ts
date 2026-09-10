// What THIS build knows, packaged as the deps the flow package reader takes
// (the agents' `agent-package-context.ts` for flows, W8 Stage 6).
//
// Separate from `flow-package.ts` on purpose: this file reaches the live app
// — `app.getVersion()` and the tool registry (which pulls the engines) —
// while the reader stays a pure function of its deps and tests without an app.

import { app } from 'electron';
import type { FlowManifestContext } from '../../../shared/flows/flow-package';
import { listToolIds } from '../agents/tools/registry';
import type { FlowPackageDeps } from './flow-package';

export function buildFlowManifestContext(): FlowManifestContext {
  return { appVersion: app.getVersion(), toolIds: listToolIds() };
}

/** The deps every install, scan and import in the running app uses. */
export function buildFlowPackageDeps(): FlowPackageDeps {
  return { manifestContext: buildFlowManifestContext() };
}
