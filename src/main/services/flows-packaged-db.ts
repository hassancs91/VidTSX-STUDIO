// The `flows` rows that mirror a packaged flow's folder (W8 Stage 6,
// flows plan §1.7). A built-in or installed flow lives on disk; its row here
// is a CACHE written by `flow-catalog.ts` so every reader of the table — the
// Flows page, the runner, `run_flow`'s listing, the run history's foreign
// key — sees packaged flows through the one path user flows already take.
// Shares `flows-projects-db.ts`'s connection; nothing here parses a graph.

import type { FlowSource } from '../../shared/types/flows';
import { getDb } from './flows-projects-db';

export type PackagedFlowSource = Extract<FlowSource, 'builtin' | 'installed'>;

export interface PackagedFlowRow {
  id: string;
  name: string;
  description: string;
  /** The serialised `FlowDoc` (the manifest without its package fields). */
  graphJson: string;
  source: PackagedFlowSource;
  /** The manifest file's mtime — what `updatedAt` reads, so the `run_flow`
   *  listing's fingerprint only changes when the flow does. */
  updatedAt: number;
}

/** Insert or refresh one packaged row. `created_at`, `thumbnail` and the
 *  gallery folder survive a refresh; `INSERT OR REPLACE` would cascade the
 *  flow's runs away on every scan. */
export function upsertPackagedFlow(row: PackagedFlowRow): void {
  getDb()
    .prepare(
      `INSERT INTO flows (id, name, description, graph_json, thumbnail, created_at, updated_at, doc_version, origin, source)
       VALUES (@id, @name, @description, @graphJson, NULL, @updatedAt, @updatedAt, 2, NULL, @source)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         graph_json = excluded.graph_json,
         updated_at = excluded.updated_at,
         doc_version = 2,
         source = excluded.source`,
    )
    .run(row);
}

/** Every row whose source is a package cache, with what it was written from. */
export function listPackagedFlowRows(): Array<{ id: string; source: PackagedFlowSource; updatedAt: number }> {
  return getDb()
    .prepare("SELECT id, source, updated_at FROM flows WHERE source IN ('builtin', 'installed')")
    .all()
    .map((r) => {
      const row = r as { id: string; source: PackagedFlowSource; updated_at: number };
      return { id: row.id, source: row.source, updatedAt: row.updated_at };
    });
}

/** `id → graph_json` for every row — what the list decoration reads params from. */
export function listFlowGraphJson(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of getDb().prepare('SELECT id, graph_json FROM flows').all()) {
    const row = r as { id: string; graph_json: string };
    out[row.id] = row.graph_json;
  }
  return out;
}

/** The row's source, or null when there is no such row. */
export function flowSourceOf(id: string): FlowSource | null {
  const row = getDb().prepare('SELECT source FROM flows WHERE id = ?').get(id) as { source: string } | undefined;
  return row ? (row.source as FlowSource) : null;
}

/** Drop cache rows whose folder is gone (their runs cascade with them). */
export function deletePackagedFlowRows(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const del = getDb().prepare("DELETE FROM flows WHERE id = ? AND source IN ('builtin', 'installed')");
  for (const id of ids) del.run(id);
}
