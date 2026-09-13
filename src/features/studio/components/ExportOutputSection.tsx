import { RENDER_QUALITY_OPTIONS, type RenderQualityLevel, type ResolutionOption, type ResolutionPresetId } from '@shared/render-presets';
import type { ExportSource } from '@shared/studio/export-source';
import type { HeavyFootage } from '../services/export-estimate';

interface Props {
  options: readonly ResolutionOption[];
  resolution: ResolutionPresetId;
  quality: RenderQualityLevel;
  onResolution: (value: ResolutionPresetId) => void;
  onQuality: (value: RenderQualityLevel) => void;
  /** Source (Phase 2): the toggle shows only when every timeline video asset has a ready proxy. */
  source: ExportSource;
  sourceAvailable: boolean;
  /** Timeline video assets without a ready proxy (why the toggle is missing). */
  sourceMissing: string[];
  onSource: (value: ExportSource) => void;
  disabled: boolean;
  /** Timeline sources whose decode dominates the export (empty = no notice). */
  heavy: HeavyFootage[];
  /** The per-engine estimate line for the notice, already worded. */
  estimateText: string | null;
}

const SELECT = 'flex-1 min-w-0 bg-app-base border border-border rounded px-2 py-1 text-[11px] text-text-secondary outline-none';

/**
 * The Export dialog's Output section (docs/studio/EXPORT_OUTPUT_OPTIONS_PLAN.md):
 * resolution (never above the project size), quality, the proxy-source
 * toggle for a draft, and the heavy-footage notice. Same controls for a full
 * and a range export.
 */
export function ExportOutputSection({
  options, resolution, quality, onResolution, onQuality,
  source, sourceAvailable, sourceMissing, onSource,
  disabled, heavy, estimateText,
}: Props) {
  const qualityLabel = RENDER_QUALITY_OPTIONS.find((q) => q.value === quality);
  return (
    <div className="flex flex-col gap-1.5" data-export-output>
      <div className="text-[11px] text-text-muted">Output</div>
      <div className="flex gap-2">
        <label className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="text-[10px] text-text-dim">Resolution</span>
          <select
            className={SELECT}
            value={resolution}
            disabled={disabled}
            onChange={(e) => onResolution(e.target.value as ResolutionPresetId)}
            data-export-resolution
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 min-w-0 flex flex-col gap-1">
          <span className="text-[10px] text-text-dim">Quality</span>
          <select
            className={SELECT}
            value={quality}
            disabled={disabled}
            onChange={(e) => onQuality(e.target.value as RenderQualityLevel)}
            data-export-quality
          >
            {RENDER_QUALITY_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="text-[10px] text-text-ghost">
        {options.length > 1 ? 'A smaller size checks the cut faster and takes less disk. ' : 'The project is already at the smallest preset size. '}
        {qualityLabel?.label}: {qualityLabel?.hint.toLowerCase()}.
      </div>

      {sourceAvailable ? (
        <label className="flex items-start gap-2 text-[11px] text-text-muted cursor-pointer" data-export-source>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={source === 'proxy'}
            disabled={disabled}
            onChange={(e) => onSource(e.target.checked ? 'proxy' : 'original')}
          />
          <span>
            Draft from the preview proxies
            <span className="block text-[10px] text-text-dim">
              Reads the 540p preview copies instead of the camera files — the fast way to check a cut.
              The picture is proxy quality; the audio is the original either way. On by default at 540p and under.
            </span>
          </span>
        </label>
      ) : sourceMissing.length > 0 ? (
        <div className="text-[10px] text-text-ghost" data-export-source-missing>
          A draft from the preview proxies becomes available once every clip has one — still missing for {sourceMissing.join(', ')}.
        </div>
      ) : null}

      {heavy.length > 0 && (
        <div className="flex flex-col gap-0.5 p-2 rounded-[6px] bg-app-base" style={{ border: '0.5px solid var(--color-border)' }} data-export-heavy>
          <div className="text-[10px] text-text-muted">
            Heavy footage on the timeline:{' '}
            {heavy.map((h) => `${h.fileName} (${h.reasons.join(' · ')})`).join(', ')}.
          </div>
          <div className="text-[10px] text-text-dim">
            {source === 'proxy'
              ? 'A draft skips the expensive decode: the proxies are what the preview already plays.'
              : 'Decoding the source is the cost, so a smaller output saves encode time and disk, not the decode.'}
            {estimateText && <> {estimateText}</>}
          </div>
        </div>
      )}
      {heavy.length === 0 && estimateText && (
        <div className="text-[10px] text-text-ghost" data-export-estimate>{estimateText}</div>
      )}
    </div>
  );
}
