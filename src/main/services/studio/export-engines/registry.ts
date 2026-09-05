/**
 * Runtime registry of export engines (docs/export-engines-plan.md D1): the
 * catalogue in `src/shared/studio/export-engines.ts` names them, this maps an
 * id to its implementation. Same shape as the LLM / image / STT engines:
 * register at startup, resolve per export, list for the picker.
 */
import {
  DEFAULT_EXPORT_ENGINE_ID,
  EXPORT_ENGINES,
  isExportEngineId,
  type ExportEngineId,
} from '../../../../shared/studio/export-engines';
import type { StudioExportEngineStatus } from '../../../../shared/ipc/types';
import type { ExportEngine } from './types';

const engines = new Map<ExportEngineId, ExportEngine>();

export function registerExportEngine(engine: ExportEngine): void {
  if (!isExportEngineId(engine.id)) {
    throw new Error(`Export engine "${engine.id}" is not in the catalogue (src/shared/studio/export-engines.ts)`);
  }
  if (engines.has(engine.id)) {
    throw new Error(`Export engine "${engine.id}" is already registered`);
  }
  engines.set(engine.id, engine);
}

export function hasExportEngine(id: string): boolean {
  return isExportEngineId(id) && engines.has(id);
}

/** Throws a readable error — an export must never fall through to nothing. */
export function resolveExportEngine(id: string): ExportEngine {
  const engine = isExportEngineId(id) ? engines.get(id) : undefined;
  if (!engine) {
    throw new Error(`Export engine "${id}" is not available in this build`);
  }
  return engine;
}

export function listExportEngineIds(): ExportEngineId[] {
  // Catalogue order, registered only — the picker lists what can run.
  return EXPORT_ENGINES.map((e) => e.id).filter((id) => engines.has(id));
}

/** Picker rows: registered engines in catalogue order with their availability. */
export async function listExportEngineStatus(): Promise<StudioExportEngineStatus[]> {
  const rows: StudioExportEngineStatus[] = [];
  for (const id of listExportEngineIds()) {
    const engine = engines.get(id);
    if (!engine) continue;
    try {
      const availability = await engine.availability();
      rows.push(
        availability.available
          ? { id, available: true }
          : { id, available: false, unavailableReason: availability.reason },
      );
    } catch (err) {
      rows.push({ id, available: false, unavailableReason: err instanceof Error ? err.message : String(err) });
    }
  }
  return rows;
}

/**
 * The engine an export should use when the requested one cannot: the
 * catalogue default, which is always registered (the Remotion path).
 */
export function fallbackExportEngineId(): ExportEngineId {
  return DEFAULT_EXPORT_ENGINE_ID;
}

/** Tests only. */
export function resetExportEnginesForTests(): void {
  engines.clear();
}
