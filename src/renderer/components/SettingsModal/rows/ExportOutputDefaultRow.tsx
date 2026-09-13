import {
  EXPORT_RESOLUTION_PRESETS,
  RENDER_QUALITY_OPTIONS,
  type RenderQualityLevel,
  type ResolutionPresetId,
} from '@shared/render-presets';

const SELECT = 'bg-app-base border border-border rounded px-2 py-1 text-[12px] text-text-secondary outline-none focus:border-accent cursor-pointer shrink-0';

/**
 * Settings › Rendering — the Output the Studio Export dialog starts on
 * (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md Phase 2): a resolution preset
 * (never above the project size — a preset the project is smaller than falls
 * back to Full in the dialog) and a quality level. A project's own last
 * choice wins over these.
 */
export function ExportOutputDefaultRow({
  renderDefaultExportResolution,
  renderDefaultExportQuality,
  setRenderDefaultExportOutput,
  settingsLoading,
}: {
  renderDefaultExportResolution: ResolutionPresetId;
  renderDefaultExportQuality: RenderQualityLevel;
  setRenderDefaultExportOutput: (value: { resolution: ResolutionPresetId; quality: RenderQualityLevel }) => Promise<boolean>;
  settingsLoading: boolean;
}) {
  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border" data-export-output-default-row>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-1">Default Studio export output</div>
          <div className="text-[10px] text-text-dim">
            Resolution and quality the Export dialog starts on. Each project remembers its own last
            choice, which wins over this.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            className={SELECT}
            value={renderDefaultExportResolution}
            onChange={(e) => void setRenderDefaultExportOutput({ resolution: e.target.value as ResolutionPresetId, quality: renderDefaultExportQuality })}
            disabled={settingsLoading}
            data-export-default-resolution
          >
            <option value="original">Full (project size)</option>
            {EXPORT_RESOLUTION_PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            className={SELECT}
            value={renderDefaultExportQuality}
            onChange={(e) => void setRenderDefaultExportOutput({ resolution: renderDefaultExportResolution, quality: e.target.value as RenderQualityLevel })}
            disabled={settingsLoading}
            data-export-default-quality
          >
            {RENDER_QUALITY_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>{q.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
