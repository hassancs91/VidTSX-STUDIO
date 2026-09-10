// Params ↔ node config bindings (flows plan §1.1, §1.8, W8 Stage 2). Pure:
// the inspector's "Expose as parameter" toggle, the locked-key rule, the
// per-node `pause` flag, and the run form's default values all go through
// here, so a bound key is defined once.
//
// A param's value is one string / number, so a field whose config key holds
// bytes (`image-upload` → `base64`) exposes the tool's PATH key instead: the
// run form hands `input_image_file` an absolute path, never base64 (§11).

import type { ConfigField, DataType, FlowDoc, FlowNode, FlowParam, FlowParamKind } from '../types/flows';

/** What exposing a config field creates: the bound key and the form kind. */
export interface BindTarget {
  key: string;
  kind: FlowParamKind;
}

/** The two keys `input_video_file` takes; a text field on one of them exposes as `video`. */
const VIDEO_PATH_KEYS = new Set(['filePath', 'entryId']);

export function bindTargetFor(field: ConfigField, primaryOutput?: DataType): BindTarget {
  switch (field.kind) {
    case 'image-upload':
      return { key: 'filePath', kind: 'image' };
    case 'gallery-image-picker':
      return { key: field.key, kind: 'image' };
    case 'text':
      if (primaryOutput === 'video' && VIDEO_PATH_KEYS.has(field.key)) return { key: field.key, kind: 'video' };
      return { key: field.key, kind: 'text' };
    default:
      return { key: field.key, kind: field.kind };
  }
}

/** The param bound to this node's key, if any. */
export function boundParam(doc: Pick<FlowDoc, 'params'>, nodeId: string, key: string): FlowParam | null {
  return doc.params.find((p) => p.bind.some((b) => b.nodeId === nodeId && b.key === key)) ?? null;
}

/** Config keys of a node the inspector shows locked (§1.1 rules). */
export function lockedKeys(doc: Pick<FlowDoc, 'params'>, nodeId: string): Set<string> {
  const keys = new Set<string>();
  for (const p of doc.params) for (const b of p.bind) if (b.nodeId === nodeId) keys.add(b.key);
  return keys;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'param';
}

/** A param id from the key, made unique against the doc's params. */
export function paramIdFor(doc: Pick<FlowDoc, 'params'>, key: string): string {
  const base = slug(key);
  const taken = new Set(doc.params.map((p) => p.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export interface ExposeInput {
  nodeId: string;
  field: ConfigField;
  /** The node's first output port type — decides `video` for path fields. */
  primaryOutput?: DataType;
  label?: string;
}

/**
 * "Expose as parameter": a new `params[]` entry bound to the field's target
 * key, seeded with the field's hints and the node's current value as the
 * default. Already bound → unchanged. The target key is added to the node's
 * config when absent (the structural validator requires a bind to name a
 * config key).
 */
export function exposeParam(doc: FlowDoc, input: ExposeInput): FlowDoc {
  const node = doc.graph.nodes.find((n) => n.id === input.nodeId);
  if (!node) return doc;
  const target = bindTargetFor(input.field, input.primaryOutput);
  if (boundParam(doc, node.id, target.key)) return doc;

  const field = input.field;
  const label = input.label ?? ('label' in field ? field.label : target.key);
  const current = node.config[target.key];
  const param: FlowParam = {
    id: paramIdFor(doc, target.key),
    label,
    kind: target.kind,
    bind: [{ nodeId: node.id, key: target.key }],
    ...(field.kind === 'select' ? { options: field.options.map((o) => ({ value: o.value, label: o.label })) } : {}),
    ...('placeholder' in field && field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.kind === 'prompt' && field.rows ? { rows: field.rows } : {}),
    ...(field.kind === 'number' && field.min !== undefined ? { min: field.min } : {}),
    ...(field.kind === 'number' && field.max !== undefined ? { max: field.max } : {}),
    ...(field.kind === 'number' && field.step !== undefined ? { step: field.step } : {}),
    ...(current !== undefined && current !== '' && target.kind !== 'image' && target.kind !== 'video'
      ? { default: current }
      : {}),
  };
  const nodes = doc.graph.nodes.map((n) =>
    n.id === node.id && !(target.key in n.config) ? { ...n, config: { ...n.config, [target.key]: '' } } : n,
  );
  return { ...doc, params: [...doc.params, param], graph: { ...doc.graph, nodes } };
}

/** Remove this node's binding; a param with no bindings left goes with it. */
export function unexposeParam(doc: FlowDoc, nodeId: string, key: string): FlowDoc {
  const params = doc.params
    .map((p) => ({ ...p, bind: p.bind.filter((b) => !(b.nodeId === nodeId && b.key === key)) }))
    .filter((p) => p.bind.length > 0);
  return params.length === doc.params.length && params.every((p, i) => p.bind.length === doc.params[i].bind.length)
    ? doc
    : { ...doc, params };
}

export function setNodePause(doc: FlowDoc, nodeId: string, pause: boolean): FlowDoc {
  const nodes: FlowNode[] = doc.graph.nodes.map((n) => (n.id === nodeId && n.pause !== pause ? { ...n, pause } : n));
  return { ...doc, graph: { ...doc.graph, nodes } };
}

export function hasPauseNode(doc: Pick<FlowDoc, 'graph'>): boolean {
  return doc.graph.nodes.some((n) => n.pause);
}

/** The run form's starting values: each param's default, then the prefill (open question 1 of §12). */
export function initialParamValues(
  params: readonly FlowParam[],
  prefill: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const p of params) if (p.default !== undefined) values[p.id] = p.default;
  for (const [id, value] of Object.entries(prefill)) if (params.some((p) => p.id === id)) values[id] = value;
  return values;
}

/** Required params the values do not satisfy — the Run gate. */
export function missingRequiredParams(params: readonly FlowParam[], values: Readonly<Record<string, unknown>>): FlowParam[] {
  return params.filter((p) => {
    if (!p.required) return false;
    const v = values[p.id];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
}
