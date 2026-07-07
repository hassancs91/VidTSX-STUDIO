import { useEffect, useState } from 'react';
import type { TranscriptSegment } from '@shared/ipc/types';
import type {
  CaptionStyleId,
  CaptionBaseSettings,
  CaptionStyleDefinition,
} from '@shared/captions/types';
import { CAPTION_STYLES } from '@shared/captions/templates';
import type { ExportFormat } from '../hooks/useStudioCaptions';

interface CaptionsTabProps {
  status: 'idle' | 'generating' | 'done' | 'error';
  segments: TranscriptSegment[];
  styleId: CaptionStyleId | null;
  // Shared base settings (position, fontSize). Project-level.
  baseSettings: CaptionBaseSettings;
  // Resolved settings for the active style (declared defaults merged with
  // stored config). Project-level — no segment overrides applied here.
  activeStyleSettings: unknown;
  // Definition for the active style — provides the ConfigPanel component.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeStyleDefinition: CaptionStyleDefinition<any> | undefined;
  error: string | null;
  hasAnalysis: boolean;
  // The source segment currently selected on the timeline (or via the segment
  // editor list). When set, the settings controls below switch into
  // "override" mode — they read effective values and write to per-segment
  // overrides instead of globals.
  selectedSegmentId: number | null;
  onSelectSegment: (segmentId: number | null) => void;
  onGenerate: () => void;
  onStyleChange: (id: CaptionStyleId) => void;
  // Global setting writers.
  onBaseSettingsChange: (updates: Partial<CaptionBaseSettings>) => void;
  onStyleSettingsChange: (styleId: CaptionStyleId, next: unknown) => void;
  // Per-segment override writers.
  onSetBaseOverride: <K extends keyof CaptionBaseSettings>(
    segmentId: number,
    key: K,
    value: CaptionBaseSettings[K],
  ) => void;
  onClearBaseOverride: (segmentId: number, key: keyof CaptionBaseSettings) => void;
  onSetSegmentStyleSnapshot: (
    segmentId: number,
    styleId: CaptionStyleId,
    full: Record<string, unknown>,
  ) => void;
  onClearAllSegmentOverrides: (segmentId: number) => void;
  onUpdateSegmentText: (id: number, text: string) => void;
  onExport: (format: ExportFormat) => void;
  onClear: () => void;
}

function formatTimecode(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function CaptionsTab({
  status,
  segments,
  styleId,
  baseSettings,
  activeStyleSettings,
  activeStyleDefinition,
  error,
  hasAnalysis,
  selectedSegmentId,
  onSelectSegment,
  onGenerate,
  onStyleChange,
  onBaseSettingsChange,
  onStyleSettingsChange,
  onSetBaseOverride,
  onClearBaseOverride,
  onSetSegmentStyleSnapshot,
  onClearAllSegmentOverrides,
  onUpdateSegmentText,
  onExport,
  onClear,
}: CaptionsTabProps) {
  const [segmentsExpanded, setSegmentsExpanded] = useState(false);

  // Auto-expand the segment editor when a segment gets selected from outside
  // (e.g. user clicked a caption clip on the timeline) so they can see which
  // one is active without hunting.
  useEffect(() => {
    if (selectedSegmentId != null) setSegmentsExpanded(true);
  }, [selectedSegmentId]);

  const isBusy = status === 'generating';
  const hasCaptions = segments.length > 0;
  // Captions only ever generate from an existing analysis — we never analyze
  // from here. Without analysis the button is gated (see the empty state below).
  const buttonDisabled = isBusy || !hasAnalysis;

  const buttonLabel = isBusy
    ? 'Generating…'
    : hasCaptions
      ? 'Regenerate from Analysis'
      : 'Generate from Analysis';

  const buttonTitle = hasAnalysis
    ? 'Chunk captions from the analysis transcript'
    : 'Run Analyze first to generate captions';

  // Gated empty state — no analysis and nothing to edit yet. Mirrors Auto-cut:
  // captions simply require the analysis first.
  if (!hasAnalysis && !hasCaptions) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-[24px] gap-[10px] text-center">
        <div
          className="w-[36px] h-[36px] rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--color-app-active)',
            color: 'var(--color-text-dim)',
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <span className="text-text-muted text-[11px] font-medium">
          Run Analyze first
        </span>
        <p className="text-text-ghost text-[10px] leading-snug">
          Captions require the analysis first. Open the{' '}
          <span className="text-text-muted">Analyze</span> tab and run it.
        </p>
      </div>
    );
  }

  const selectedSegment =
    selectedSegmentId != null ? segments.find((s) => s.id === selectedSegmentId) ?? null : null;

  // Effective settings the controls render and write through:
  //   - In global mode: project-level base/style settings, writes hit globals.
  //   - In override mode: project + segment override merged for read, writes
  //     hit per-segment overrides.
  const inOverrideMode = selectedSegment != null;
  const effectiveBase: CaptionBaseSettings = selectedSegment
    ? { ...baseSettings, ...selectedSegment.baseOverrides }
    : baseSettings;
  const effectiveStyle =
    selectedSegment && styleId
      ? {
          ...(activeStyleSettings as Record<string, unknown>),
          ...(selectedSegment.styleOverrides?.[styleId] ?? {}),
        }
      : (activeStyleSettings as Record<string, unknown>);

  // Override flags per base key — drives the small "reset" link next to a
  // control when the segment has its own override for that key.
  const baseHasOverride = (key: keyof CaptionBaseSettings) =>
    !!selectedSegment?.baseOverrides && key in selectedSegment.baseOverrides;
  const segmentHasAnyOverride = !!(
    selectedSegment?.baseOverrides ||
    (styleId && selectedSegment?.styleOverrides?.[styleId])
  );

  // Slider / preset callbacks switch sink based on mode.
  const writeFontSize = (value: number) => {
    if (inOverrideMode && selectedSegment) {
      onSetBaseOverride(selectedSegment.id, 'fontSize', value);
    } else {
      onBaseSettingsChange({ fontSize: value });
    }
  };
  const writePosition = (position: { x: number; y: number }) => {
    if (inOverrideMode && selectedSegment) {
      onSetBaseOverride(selectedSegment.id, 'position', position);
    } else {
      onBaseSettingsChange({ position });
    }
  };
  const writeStyleSettings = (next: Record<string, unknown>) => {
    if (inOverrideMode && selectedSegment && styleId) {
      onSetSegmentStyleSnapshot(selectedSegment.id, styleId, next);
    } else if (styleId) {
      onStyleSettingsChange(styleId, next);
    }
  };

  // Section accent colour — flips to a softer hue when in override mode so the
  // user can see at a glance their changes are scoped to one segment.
  const sectionAccent = inOverrideMode ? 'rgba(239,159,39,1)' : 'var(--color-text-muted)';

  return (
    <div className="flex flex-col gap-[12px] p-[12px] overflow-auto h-full">
      {/* Generate section */}
      <div className="flex flex-col gap-[8px]">
        <span className="text-text-muted text-[10px] uppercase tracking-wider">Captions</span>
        <button
          onClick={onGenerate}
          disabled={buttonDisabled}
          className="flex items-center justify-center gap-[6px] h-[30px] rounded-[6px] text-[11px] font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-accent)' }}
          title={buttonTitle}
        >
          {isBusy && (
            <div
              className="w-[10px] h-[10px] rounded-full border-[1.5px] border-t-transparent animate-spin"
              style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
            />
          )}
          {buttonLabel}
        </button>

        {!hasAnalysis && hasCaptions && !isBusy && (
          <p className="text-text-ghost text-[10px] leading-snug">
            These captions were generated previously. To regenerate, run the{' '}
            <span className="text-text-muted">Analyze</span> tab first.
          </p>
        )}

        {status === 'error' && error && (
          <span className="text-status-error text-[10px]">{error}</span>
        )}
      </div>

      {/* Override banner — visible only when a segment is selected. */}
      {selectedSegment && (
        <div
          className="flex flex-col gap-[6px] px-[10px] py-[8px] rounded-[6px]"
          style={{
            backgroundColor: 'rgba(239,159,39,0.10)',
            border: '0.5px solid rgba(239,159,39,0.4)',
          }}
        >
          <div className="flex items-center justify-between gap-[8px]">
            <span
              className="text-[10px] font-medium uppercase tracking-wider"
              style={{ color: 'rgba(239,159,39,1)' }}
            >
              Editing one segment
            </span>
            <button
              onClick={() => onSelectSegment(null)}
              className="text-text-dim hover:text-text-primary text-[10px]"
              title="Deselect segment — switch back to editing globally"
            >
              Done
            </button>
          </div>
          <p className="text-text-primary text-[11px] leading-snug truncate">
            "{selectedSegment.text}"
          </p>
          <p className="text-text-ghost text-[10px] leading-snug">
            Changes below apply only to this segment. Click <span className="text-text-muted">Done</span> or an empty
            spot on the timeline to go back to editing globally.
          </p>
          {segmentHasAnyOverride && (
            <button
              onClick={() => onClearAllSegmentOverrides(selectedSegment.id)}
              className="text-[10px] text-text-dim hover:text-status-error transition-colors text-left"
            >
              Reset all overrides for this segment
            </button>
          )}
        </div>
      )}

      {/* Segment editor */}
      {segments.length > 0 && (
        <div className="flex flex-col gap-[4px]">
          <button
            onClick={() => setSegmentsExpanded(!segmentsExpanded)}
            className="flex items-center justify-between text-left"
          >
            <span className="text-text-muted text-[10px] uppercase tracking-wider">
              Segments ({segments.length})
            </span>
            <span className="text-text-dim text-[10px]">
              {segmentsExpanded ? 'Collapse' : 'Edit'}
            </span>
          </button>

          {segmentsExpanded && (
            <div
              className="flex flex-col gap-[6px] overflow-auto rounded-[4px] p-[4px]"
              style={{
                maxHeight: 300,
                backgroundColor: 'var(--color-app-base)',
              }}
            >
              {segments.map((seg) => {
                const isSelected = seg.id === selectedSegmentId;
                const hasOwnOverride = !!(
                  seg.baseOverrides ||
                  (styleId && seg.styleOverrides?.[styleId])
                );
                return (
                  <div
                    key={seg.id}
                    className="flex flex-col gap-[2px] rounded-[3px]"
                    style={{
                      padding: 4,
                      backgroundColor: isSelected ? 'rgba(239,159,39,0.10)' : 'transparent',
                      border: isSelected
                        ? '0.5px solid rgba(239,159,39,0.4)'
                        : '0.5px solid transparent',
                    }}
                  >
                    <button
                      onClick={() => onSelectSegment(isSelected ? null : seg.id)}
                      className="flex items-center justify-between gap-[6px] text-left"
                      title={isSelected ? 'Deselect' : 'Select to override settings just for this segment'}
                    >
                      <span className="text-text-ghost text-[9px] font-mono">
                        {formatTimecode(seg.start)} – {formatTimecode(seg.end)}
                      </span>
                      {hasOwnOverride && (
                        <span
                          className="w-[6px] h-[6px] rounded-full shrink-0"
                          style={{ backgroundColor: 'rgba(239,159,39,1)' }}
                          title="This segment has overrides"
                        />
                      )}
                    </button>
                    <textarea
                      defaultValue={seg.text}
                      onBlur={(e) => {
                        if (e.target.value !== seg.text) {
                          onUpdateSegmentText(seg.id, e.target.value);
                        }
                      }}
                      rows={1}
                      className="w-full px-[6px] py-[3px] rounded-[3px] text-[11px] text-text-primary resize-none"
                      style={{
                        backgroundColor: 'var(--color-app-surface)',
                        border: '0.5px solid var(--color-border)',
                        outline: 'none',
                        fontFamily: 'inherit',
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = 'var(--color-accent)';
                      }}
                      onBlurCapture={(e) => {
                        e.target.style.borderColor = 'var(--color-border)';
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Template picker */}
      {segments.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="text-text-muted text-[10px] uppercase tracking-wider">Template</span>
          <div className="flex flex-col gap-[4px]">
            {CAPTION_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => onStyleChange(style.id)}
                className="flex items-center gap-[8px] px-[8px] py-[6px] rounded-[6px] text-left transition-colors"
                style={{
                  backgroundColor: styleId === style.id
                    ? 'var(--color-app-active)'
                    : 'transparent',
                  border: styleId === style.id
                    ? '1px solid var(--color-accent)'
                    : '1px solid transparent',
                }}
              >
                <div
                  className="w-[10px] h-[10px] rounded-full shrink-0"
                  style={{ backgroundColor: style.thumbnailColor }}
                />
                <div className="flex flex-col">
                  <span className="text-text-primary text-[11px]">{style.name}</span>
                  <span className="text-text-dim text-[9px]">{style.description}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Base (Layout) settings */}
      {segments.length > 0 && styleId && (
        <div className="flex flex-col gap-[8px]">
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: sectionAccent }}
          >
            Layout{inOverrideMode && ' (segment)'}
          </span>

          {/* Font size */}
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-[10px]">Font Size</span>
              <span className="flex items-center gap-[6px]">
                <span className="text-text-dim text-[10px]">
                  {Math.round(effectiveBase.fontSize * 100)}%
                </span>
                {inOverrideMode && selectedSegment && baseHasOverride('fontSize') && (
                  <button
                    onClick={() => onClearBaseOverride(selectedSegment.id, 'fontSize')}
                    className="text-text-dim hover:text-text-primary text-[9px]"
                    title="Reset to global"
                  >
                    Reset
                  </button>
                )}
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={effectiveBase.fontSize}
              onChange={(e) => writeFontSize(parseFloat(e.target.value))}
              className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </div>

          {/* Position presets */}
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-[10px]">Position</span>
              {inOverrideMode && selectedSegment && baseHasOverride('position') && (
                <button
                  onClick={() => onClearBaseOverride(selectedSegment.id, 'position')}
                  className="text-text-dim hover:text-text-primary text-[9px]"
                  title="Reset to global"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="flex gap-[4px]">
              {([
                { label: 'Top', y: 15 },
                { label: 'Middle', y: 50 },
                { label: 'Bottom', y: 85 },
              ] as const).map((preset) => {
                const isActive = Math.abs(effectiveBase.position.y - preset.y) < 3;
                return (
                  <button
                    key={preset.label}
                    onClick={() => writePosition({ x: 50, y: preset.y })}
                    className="flex-1 h-[24px] rounded-[4px] text-[10px] font-medium transition-colors"
                    style={{
                      backgroundColor: isActive ? 'var(--color-accent)' : 'var(--color-app-active)',
                      color: isActive ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Position fine-tune slider */}
          <div className="flex flex-col gap-[4px]">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-[10px]">Fine Tune</span>
              <span className="text-text-dim text-[10px]">
                {Math.round(effectiveBase.position.y)}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={95}
              step={1}
              value={effectiveBase.position.y}
              onChange={(e) => writePosition({ x: 50, y: parseFloat(e.target.value) })}
              className="w-full h-[3px] rounded-full appearance-none cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
            />
          </div>
        </div>
      )}

      {/* Per-style settings — uses the active style's ConfigPanel. */}
      {segments.length > 0 && styleId && activeStyleDefinition?.ConfigPanel && (
        <div className="flex flex-col gap-[8px]">
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{ color: sectionAccent }}
          >
            {activeStyleDefinition.name} settings{inOverrideMode && ' (segment)'}
          </span>
          <activeStyleDefinition.ConfigPanel
            settings={effectiveStyle}
            onChange={(next) => writeStyleSettings(next as Record<string, unknown>)}
          />
        </div>
      )}

      {/* Clear button */}
      {segments.length > 0 && styleId && !inOverrideMode && (
        <button
          onClick={onClear}
          className="mt-[4px] h-[26px] rounded-[6px] text-[10px] text-text-dim hover:text-status-error transition-colors"
          style={{ backgroundColor: 'var(--color-app-active)' }}
        >
          Clear Captions
        </button>
      )}

      {/* Export */}
      {segments.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          <span className="text-text-muted text-[10px] uppercase tracking-wider">Export</span>
          <div className="flex gap-[4px]">
            <button
              onClick={() => onExport('srt')}
              className="flex-1 h-[26px] rounded-[6px] text-[10px] font-medium text-text-muted transition-colors hover:text-text-primary"
              style={{ backgroundColor: 'var(--color-app-active)' }}
            >
              SRT
            </button>
            <button
              onClick={() => onExport('vtt')}
              className="flex-1 h-[26px] rounded-[6px] text-[10px] font-medium text-text-muted transition-colors hover:text-text-primary"
              style={{ backgroundColor: 'var(--color-app-active)' }}
            >
              VTT
            </button>
            <button
              onClick={() => onExport('json')}
              className="flex-1 h-[26px] rounded-[6px] text-[10px] font-medium text-text-muted transition-colors hover:text-text-primary"
              style={{ backgroundColor: 'var(--color-app-active)' }}
            >
              JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
