/**
 * Export-engine catalogue — the single definition of every way a Studio
 * timeline can become a file (docs/export-engines-plan.md D1–D3).
 *
 * The catalogue is the part both processes read: the id union, the default,
 * and the user-facing wording. The implementations live in main
 * (`src/main/services/studio/export-engines/`) and register against these ids
 * at startup, the same split as the provider registry + engine presets.
 *
 * Names stay internal (D3): the picker shows `label` + `description` — the
 * trade-off — never "Remotion" or "passthrough". Adding an engine = one entry
 * here + one implementation file + one `registerExportEngine` call.
 */

export type ExportEngineId = 'remotion' | 'passthrough';

export interface ExportEngineDefinition {
  id: ExportEngineId;
  /** Picker label — what the user gets, not how. */
  label: string;
  /** One sentence on the trade-off, shown under the label. */
  description: string;
  /** Needs the optional full ffmpeg download (the GPU proxy encoder's binary). */
  needsFullFfmpeg: boolean;
  /** The dialog states "copies N % of this timeline" for this engine (D4),
   *  from the shared span planner (`export-spans.ts`). */
  reportsCopiedShare: boolean;
}

/** Picker order. The first entry is what ships as the default. */
export const EXPORT_ENGINES: readonly ExportEngineDefinition[] = [
  {
    id: 'remotion',
    label: 'Standard',
    description: 'Renders every frame exactly as the preview shows it. Works for every timeline.',
    needsFullFfmpeg: false,
    reportsCopiedShare: false,
  },
  {
    id: 'passthrough',
    label: 'Fast',
    description:
      'Copies untouched footage straight from the source files and renders only the edited parts. Needs the GPU encoder download.',
    needsFullFfmpeg: true,
    reportsCopiedShare: true,
  },
] as const;

export const DEFAULT_EXPORT_ENGINE_ID: ExportEngineId = EXPORT_ENGINES[0].id;

const IDS: readonly string[] = EXPORT_ENGINES.map((e) => e.id);

export function isExportEngineId(value: unknown): value is ExportEngineId {
  return typeof value === 'string' && IDS.includes(value);
}

/** Settings + IPC boundary: anything unknown falls back to the default. */
export function normalizeExportEngineId(value: unknown): ExportEngineId {
  return isExportEngineId(value) ? value : DEFAULT_EXPORT_ENGINE_ID;
}

export function exportEngineDefinition(id: ExportEngineId): ExportEngineDefinition {
  const found = EXPORT_ENGINES.find((e) => e.id === id);
  if (!found) throw new Error(`Unknown export engine "${id}"`);
  return found;
}
