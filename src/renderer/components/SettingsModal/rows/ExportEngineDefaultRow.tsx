import { EXPORT_ENGINES, type ExportEngineId } from '@shared/studio/export-engines';

/**
 * Settings › Rendering — the Studio export engine the Export dialog starts
 * on (docs/export-engines-plan.md D2). Options show the trade-off, never the
 * engine's internal name (D3); with one engine registered the row still
 * exists so the choice has a home the day a second one ships.
 */
export function ExportEngineDefaultRow({
  renderDefaultExportEngine,
  setRenderDefaultExportEngine,
  settingsLoading,
}: {
  renderDefaultExportEngine: ExportEngineId;
  setRenderDefaultExportEngine: (value: ExportEngineId) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  const current = EXPORT_ENGINES.find((e) => e.id === renderDefaultExportEngine) ?? EXPORT_ENGINES[0];
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border" data-export-engine-default-row>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">
            Default Studio export
          </div>
          <div className="text-[10px] text-text-dim">
            How Studio timelines are turned into a file. The Export dialog starts on this and can
            change it per export.
          </div>
          <div className="text-[10px] text-text-dim mt-1 italic">{current.description}</div>
        </div>
        <select
          className="bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer shrink-0"
          value={renderDefaultExportEngine}
          onChange={(e) => void setRenderDefaultExportEngine(e.target.value as ExportEngineId)}
          disabled={settingsLoading}
        >
          {EXPORT_ENGINES.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
