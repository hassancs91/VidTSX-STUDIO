// What the Flows page sees on a row beyond the table's columns (W8 Stage 6):
// the package behind a `builtin` / `installed` row (trust tag, version,
// author, the agent it came with) and the `image` / `video` params another
// screen can prefill. Both are derived, never stored — the catalog holds
// the package info from its last scan, the params come from the document.

import type { FlowProject, FlowProjectSummary } from '../../../shared/ipc/types';
import { handoffParamsFromJson } from '../../../shared/flows/flow-handoff';
import { packageInfoFor } from './flow-catalog';

export function decorateSummary<T extends FlowProjectSummary>(row: T, graphJson?: string): T {
  const pkg = row.source === 'builtin' || row.source === 'installed' ? packageInfoFor(row.id) : undefined;
  return {
    ...row,
    ...(pkg ? { package: pkg } : {}),
    ...(graphJson !== undefined ? { handoffParams: handoffParamsFromJson(graphJson) } : {}),
  };
}

export function decorateProject(project: FlowProject): FlowProject {
  return decorateSummary(project, project.graphJson);
}
