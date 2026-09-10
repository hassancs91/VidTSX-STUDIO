// The flow_runs table (Phase 5 run history): the summary rows behind the
// history dropdown, capped per flow. Split out of flows-projects-db.ts in W8
// Stage 0; shares that module's connection. The run FOLDER (run.json,
// artifacts) is the Stage 1 runner's, not this table's.

import type { FlowRunRecord, FlowRunSummary, FlowRunStatus } from '../../shared/ipc/types';
import { getDb } from './flows-projects-db';

const RUN_HISTORY_CAP = 20;

interface FlowRunRow {
  id: string;
  flow_id: string;
  status: string;
  started_at: number;
  finished_at: number | null;
  error: string | null;
  node_results: string;
}

function rowToRunSummary(row: FlowRunRow): FlowRunSummary {
  return {
    id: row.id,
    flowId: row.flow_id,
    status: row.status as FlowRunStatus,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
  };
}

function rowToRunRecord(row: FlowRunRow): FlowRunRecord {
  return {
    ...rowToRunSummary(row),
    nodeResults: row.node_results,
  };
}

export interface PersistRunInput {
  id: string;
  flowId: string;
  status: FlowRunStatus;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
  nodeResults: string;
}

/** Insert or replace: the main runner (W8 Stage 1) writes the row when a run
 *  starts and again on every status change, so the same id upserts. */
export function persistRun(input: PersistRunInput): FlowRunRecord {
  const database = getDb();
  const insertAndPrune = database.transaction((row: PersistRunInput) => {
    database
      .prepare(`
        INSERT OR REPLACE INTO flow_runs (id, flow_id, status, started_at, finished_at, error, node_results)
        VALUES (@id, @flowId, @status, @startedAt, @finishedAt, @error, @nodeResults)
      `)
      .run(row);

    // Prune oldest runs above the cap (per flow).
    database
      .prepare(`
        DELETE FROM flow_runs
        WHERE flow_id = @flowId
          AND id NOT IN (
            SELECT id FROM flow_runs
            WHERE flow_id = @flowId
            ORDER BY started_at DESC
            LIMIT @cap
          )
      `)
      .run({ flowId: row.flowId, cap: RUN_HISTORY_CAP });
  });
  insertAndPrune(input);

  const row = database
    .prepare('SELECT * FROM flow_runs WHERE id = ?')
    .get(input.id) as FlowRunRow;
  return rowToRunRecord(row);
}

export function listRuns(flowId: string): FlowRunSummary[] {
  const database = getDb();
  const rows = database
    .prepare('SELECT * FROM flow_runs WHERE flow_id = ? ORDER BY started_at DESC')
    .all(flowId) as FlowRunRow[];
  return rows.map(rowToRunSummary);
}

export function loadRun(runId: string): FlowRunRecord | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM flow_runs WHERE id = ?')
    .get(runId) as FlowRunRow | undefined;
  return row ? rowToRunRecord(row) : null;
}
