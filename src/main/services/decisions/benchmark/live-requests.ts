/**
 * The gated live test's requests (DECISION_MODELS_DESIGN.md §15.1; ruling D-r16 (b), (c)): D1's T2 / T3 sets framed by the PRODUCT's
 * built-ins — `route_request`'s question + D1's T2 rule (passed verbatim, as the benchmark does) + the families as criteria;
 * `check_matches_request`'s rule, question and criteria — and packed ONE request per task, keyed as D1 keyed them (`t2_01` …), the way
 * D1's hosted runner sent them. The dry-run test pins both bodies EQUAL to D1's recorded dry-run bodies. Pure.
 */
import type { DecisionQuestion, DecisionTaskFamily } from '../../../../shared/types/decisions';
import { CHECK_MATCHES_CRITERIA, CHECK_MATCHES_STATE, checkMatchesQuestion } from '../../agents/tools/check-matches-request';
import { DEFAULT_ROUTE_SUBJECT, routeQuestion } from '../../agents/tools/route-request';
import type { T2Fixture, T3Fixture, T3Row } from './types';

export interface LiveTaskRequest {
  task: 't2' | 't3';
  family: DecisionTaskFamily;
  state: string;
  questions: Record<string, DecisionQuestion>;
  /** question key → the fixture row id */
  rows: Array<{ key: string; id: string }>;
}

/** D1's question key for a row id (`K1\hosted-run.cjs`: non-word characters → `_`). */
const keyOf = (id: string): string => id.replace(/[^A-Za-z0-9_]/g, '_');

/** D1's T2 criteria: each family's meaning; `none` has no tools. */
const NONE_MEANING = 'no editing tool: a question, thanks, a preference to remember, notes';

type ItemKind = Parameters<typeof checkMatchesQuestion>[0];
const T3_KINDS: readonly ItemKind[] = ['template', 'caption', 'clip'];

function kindOf(row: T3Row): ItemKind {
  const kind = T3_KINDS.find((k) => k === row.kind);
  if (!kind) throw new Error(`T3 row ${row.id}: unknown kind`);
  return kind;
}

/** D1's T3 question = the header, the item line(s), then the request line — the built-in rebuilds it from the item + the request. */
const itemOf = (row: T3Row): string => row.question.split('\n').slice(1, -1).join('\n');

export function buildLiveBenchmarkRequests(t2: T2Fixture, t3: T3Fixture): { t2: LiveTaskRequest; t3: LiveTaskRequest } {
  const options = Object.fromEntries(t2.families.map((f) => [f, t2.familyTools[f]?.meaning ?? NONE_MEANING]));
  const t2Questions: Record<string, DecisionQuestion> = {};
  for (const row of t2.rows) {
    t2Questions[keyOf(row.id)] = { type: 'choice', instructions: routeQuestion(DEFAULT_ROUTE_SUBJECT, row.request), criteria: options };
  }
  const t3Questions: Record<string, DecisionQuestion> = {};
  for (const row of t3.rows) {
    const request = row.request ?? row.scriptLine ?? '';
    t3Questions[keyOf(row.id)] = { type: 'noul', instructions: checkMatchesQuestion(kindOf(row), itemOf(row), request), criteria: { ...CHECK_MATCHES_CRITERIA } };
  }
  return {
    t2: { task: 't2', family: 'routing', state: t2.instruction, questions: t2Questions, rows: t2.rows.map((r) => ({ key: keyOf(r.id), id: r.id })) },
    t3: { task: 't3', family: 'verify', state: CHECK_MATCHES_STATE, questions: t3Questions, rows: t3.rows.map((r) => ({ key: keyOf(r.id), id: r.id })) },
  };
}
