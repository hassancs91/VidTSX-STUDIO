// Param detection for a frozen flow (flows plan §1.5 step 3, W8 Stage 5).
//
// An argument the agent used is a PARAMETER when its value came from the
// user: an intake answer (the starter tree, agents plan §1.9) or a reply to
// an `ask_user` pick or form. Detection is a value match — normalised text
// equality against every value the user gave — because that is the one
// signal the session actually records; the agent's own rewrites are the
// agent's, and stay locked. Pure.

import type { StarterAnswers } from '../../../shared/types/agents';
import type { StarterTree } from '../../../shared/agents/starter';
import { isStarterTextNode, STARTER_OTHER } from '../../../shared/agents/starter';
import type { FlowDoc, FlowNode, FlowParam, FlowParamKind, FlowParamOption } from '../../../shared/types/flows';
import { paramIdFor } from '../../../shared/flows/params';
import type { InteractionReplyRecord, ToolCallRecord } from '../agents/tool-call-log';

/** One thing the user typed or chose, with the field it answered. */
export interface UserField {
  label: string;
  kind: FlowParamKind;
  options?: FlowParamOption[];
  /** Every form the value may take in an argument (an option's id and its label). */
  values: string[];
  source: 'intake' | 'pick' | 'form';
}

interface AskOption {
  id: string;
  label: string;
}

/** Whitespace-collapsed, case-folded — what two values must share to match. */
export function normaliseValue(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The starter answers as fields, labelled by the tree's questions. */
export function collectIntakeFields(answers: StarterAnswers | undefined, tree: StarterTree | undefined): UserField[] {
  const fields: UserField[] = [];
  if (!answers) return fields;
  for (const [nodeId, answer] of Object.entries(answers)) {
    const node = tree?.nodes[nodeId];
    const label = node?.question ?? nodeId;
    if (!node || isStarterTextNode(node)) {
      if (answer.text) fields.push({ label, kind: node?.multiline ? 'prompt' : 'text', values: [answer.text], source: 'intake' });
      continue;
    }
    const values: string[] = [];
    for (const id of answer.ids ?? []) {
      if (id === STARTER_OTHER) continue;
      values.push(id);
      const option = node.options.find((o) => o.id === id);
      if (option) values.push(option.label);
    }
    if (answer.text) values.push(answer.text);
    if (values.length === 0) continue;
    fields.push({
      label,
      kind: 'select',
      options: node.options.map((o) => ({ value: o.id, label: o.label })),
      values,
      source: 'intake',
    });
  }
  return fields;
}

/** Answered `ask_user` picks and forms as fields, labelled by their questions. */
export function collectReplyFields(calls: readonly ToolCallRecord[], replies: readonly InteractionReplyRecord[]): UserField[] {
  const fields: UserField[] = [];
  for (const reply of replies) {
    if (reply.status !== 'answered' || !reply.values) continue;
    const call = calls.find((c) => c.tool === 'ask_user' && c.requestIds?.includes(reply.requestId));
    if (!call) continue;
    const kind = typeof call.args.kind === 'string' ? call.args.kind : 'pick';
    const question = typeof call.args.question === 'string' ? call.args.question : 'Choice';
    if (kind === 'pick') {
      const options = (Array.isArray(call.args.options) ? call.args.options : []) as AskOption[];
      const values: string[] = [];
      for (const [id, labels] of Object.entries(reply.values)) values.push(id, ...labels);
      if (values.length === 0) continue;
      fields.push({ label: question, kind: 'select', options: options.map((o) => ({ value: o.id, label: o.label })), values, source: 'pick' });
      continue;
    }
    if (kind !== 'form') continue;
    const formFields = (Array.isArray(call.args.fields) ? call.args.fields : []) as Array<{
      id: string; label: string; kind?: string; options?: AskOption[];
    }>;
    for (const field of formFields) {
      const answered = reply.values[field.id];
      if (!answered || answered.length === 0) continue;
      const paramKind: FlowParamKind = field.kind === 'multiline' ? 'prompt' : field.kind === 'select' ? 'select' : 'text';
      fields.push({
        label: field.label,
        kind: paramKind,
        ...(field.options ? { options: field.options.map((o) => ({ value: o.id, label: o.label })) } : {}),
        values: answered,
        source: 'form',
      });
    }
  }
  return fields;
}

const NEVER_PARAMS = new Set(['brandId', 'providerId', 'model', 'modelMode']);

function optionsFor(field: UserField, matched: string): FlowParamOption[] | undefined {
  if (!field.options) return undefined;
  // The param's option values take the form the argument used: an option id
  // when the id matched EXACTLY, the label otherwise — so the default is one
  // of them (an id and its label can differ by case alone).
  const byId = field.options.some((o) => typeof o === 'object' && o.value === matched);
  return field.options.map((o) => (typeof o === 'string' ? o : byId ? o : { value: o.label, label: o.label }));
}

/**
 * Bind every node config value that equals something the user gave to a
 * param carrying that field's label and kind. A field matched on several
 * nodes becomes ONE param with several binds (one value, one field).
 */
export function detectParams(doc: FlowDoc, fields: readonly UserField[]): FlowParam[] {
  const params: FlowParam[] = [];
  const byField = new Map<UserField, FlowParam>();
  const bound = new Set<string>();
  const nodes: FlowNode[] = doc.graph.nodes;
  for (const node of nodes) {
    for (const [key, value] of Object.entries(node.config)) {
      if (NEVER_PARAMS.has(key) || bound.has(`${node.id}:${key}`)) continue;
      if (typeof value !== 'string' && typeof value !== 'number') continue;
      const wanted = normaliseValue(value);
      if (wanted.length === 0) continue;
      const field = fields.find((f) => f.values.some((v) => normaliseValue(v) === wanted));
      if (!field) continue;
      bound.add(`${node.id}:${key}`);
      const existing = byField.get(field);
      if (existing) {
        existing.bind.push({ nodeId: node.id, key });
        continue;
      }
      const options = optionsFor(field, String(value));
      const param: FlowParam = {
        id: paramIdFor({ params: [...doc.params, ...params] }, field.label),
        label: field.label,
        kind: field.kind,
        ...(options ? { options } : {}),
        default: value,
        bind: [{ nodeId: node.id, key }],
      };
      byField.set(field, param);
      params.push(param);
    }
  }
  return params;
}
