// "Run a flow on this" (flows plan §1.8, W8 Stage 6) — the hand-off from
// the Library, the Video Studio and the Tools hub to the Flows screen.
//
// Those features and the Flows feature must not import each other (CLAUDE.md
// rule 1), so the hop is the app's `vidtsx:navigate` event followed by a
// `vidtsx:flows-open` event naming the flow and the params to prefill, plus
// a sessionStorage stash for the first visit (the Flows screen mounts after
// the event has fired). Same shape as the Stage 5 freeze hand-off. Pure:
// nothing here touches React or Node.

import type { FlowDoc, FlowHandoffParam, FlowParam } from '../types/flows';

export const FLOWS_OPEN_EVENT = 'vidtsx:flows-open';
export const FLOWS_HANDOFF_STASH_KEY = 'vidtsx:flows-pending-open';

export interface FlowHandoff {
  flowId: string;
  /** Keyed by `FlowParam.id`; absent for a plain "open this flow's run form". */
  prefill?: Record<string, unknown>;
}

export function isFlowHandoff(value: unknown): value is FlowHandoff {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.flowId !== 'string' || v.flowId.length === 0) return false;
  return v.prefill === undefined || (typeof v.prefill === 'object' && v.prefill !== null);
}

/** The `image` / `video` params of a document — what a card can offer to prefill. */
export function handoffParamsOf(params: readonly FlowParam[]): FlowHandoffParam[] {
  return params
    .filter((p): p is FlowParam & { kind: 'image' | 'video' } => p.kind === 'image' || p.kind === 'video')
    .map((p) => ({ id: p.id, kind: p.kind, label: p.label }));
}

/** From the stored JSON, without a full parse of the document: the summary row's helper. */
export function handoffParamsFromJson(graphJson: string): FlowHandoffParam[] {
  try {
    const doc = JSON.parse(graphJson) as Partial<FlowDoc>;
    return Array.isArray(doc.params) ? handoffParamsOf(doc.params) : [];
  } catch {
    return [];
  }
}

export interface FlowHandoffTarget {
  flowId: string;
  flowName: string;
  paramId: string;
  paramLabel: string;
}

/** The flows that take a param of `kind`, one entry per (flow, param). */
export function handoffTargets(
  flows: ReadonlyArray<{ id: string; name: string; handoffParams?: FlowHandoffParam[] }>,
  kind: 'image' | 'video',
): FlowHandoffTarget[] {
  const out: FlowHandoffTarget[] = [];
  for (const flow of flows) {
    for (const param of flow.handoffParams ?? []) {
      if (param.kind === kind) out.push({ flowId: flow.id, flowName: flow.name, paramId: param.id, paramLabel: param.label });
    }
  }
  return out;
}

/** The hand-off for one target and one value (an absolute path or a library entry id). */
export function buildFlowHandoff(target: FlowHandoffTarget, value: string): FlowHandoff {
  return { flowId: target.flowId, prefill: { [target.paramId]: value } };
}

/** `file:///C:/x/y.mp4` (the Video Studio's url shape, built unencoded) → `C:/x/y.mp4`. */
export function fileUrlToPath(url: string): string {
  if (!url.startsWith('file://')) return url;
  let rest = url.slice('file://'.length);
  // `file:///C:/…` → `C:/…`; `file:///home/…` keeps its leading slash.
  if (/^\/[A-Za-z]:\//.test(rest)) rest = rest.slice(1);
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}
