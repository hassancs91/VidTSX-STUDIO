import { Eye, EyeOff, Pause, Play, RotateCcw, Type } from 'lucide-react';
import type { WhiteboardBackground } from '../../types';
import { ASPECT_PRESETS } from '../../services/whiteboard-service';

interface ControlsPaneProps {
  collapsed: boolean;
  onToggleCollapsed: (next: boolean) => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  previewMode: boolean;
  onTogglePreviewMode: () => void;
  onAddText: () => void;
  activeAspectId: string;
  onSetAspect: (viewBox: string) => void;
  background: WhiteboardBackground;
  onSetBackground: (bg: WhiteboardBackground) => void;
  speed: number;
  onSetSpeed: (s: number) => void;
  currentAssetNumber: number;
  totalAssets: number;
  currentStrokeInAsset: number;
  currentAssetStrokeCount: number;
  elapsed: number;
  totalDuration: number;
}

export function ControlsPane({
  collapsed,
  onToggleCollapsed,
  width,
  onResizeStart,
  playing,
  onTogglePlay,
  onRestart,
  previewMode,
  onTogglePreviewMode,
  onAddText,
  activeAspectId,
  onSetAspect,
  background,
  onSetBackground,
  speed,
  onSetSpeed,
  currentAssetNumber,
  totalAssets,
  currentStrokeInAsset,
  currentAssetStrokeCount,
  elapsed,
  totalDuration,
}: ControlsPaneProps) {
  return (
    <div
      className="flex shrink-0"
      style={{
        width: collapsed ? 24 : width,
        borderRight: '0.5px solid var(--color-border)',
      }}
    >
      {collapsed ? (
        <button
          onClick={() => onToggleCollapsed(false)}
          className="w-full flex items-center justify-center bg-app-surface text-text-dim hover:text-text-primary transition-colors cursor-pointer"
          title="Show controls"
        >
          <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.5 2L6.5 5L3.5 8" />
          </svg>
        </button>
      ) : (
        <>
          <div className="flex-1 min-w-0 flex flex-col bg-app-surface">
            <div className="flex items-center justify-between px-3 h-[36px] shrink-0" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
              <span className="text-[11px] uppercase tracking-wider text-text-dim">Controls</span>
              <button
                onClick={() => onToggleCollapsed(true)}
                className="text-text-dim hover:text-text-primary transition-colors"
                title="Hide controls"
              >
                <svg width={10} height={10} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 2L3.5 5L6.5 8" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-3 flex flex-col gap-4 overflow-auto">
              {/* Transport buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onTogglePlay}
                  className="inline-flex items-center justify-center gap-1.5 flex-1 h-[32px] text-[12px] bg-accent hover:bg-accent/90 text-white rounded-md transition-colors"
                >
                  {playing ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
                  {playing ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={onRestart}
                  className="inline-flex items-center justify-center gap-1.5 h-[32px] px-3 text-[12px] text-text-secondary hover:text-text-primary hover:bg-app-hover rounded-md transition-colors"
                  style={{ border: '0.5px solid var(--color-border)' }}
                  title="Restart"
                >
                  <RotateCcw size={14} strokeWidth={1.75} />
                  Restart
                </button>
              </div>

              {/* Show All toggle */}
              <button
                onClick={onTogglePreviewMode}
                className={`inline-flex items-center justify-center gap-1.5 h-[28px] text-[12px] rounded-md transition-colors ${
                  previewMode
                    ? 'bg-accent text-white hover:bg-accent/90'
                    : 'text-text-secondary hover:text-text-primary hover:bg-app-hover'
                }`}
                style={{
                  border: previewMode
                    ? '0.5px solid transparent'
                    : '0.5px solid var(--color-border)',
                }}
                title={previewMode ? 'Hide all (animate)' : 'Show all paths instantly'}
              >
                {previewMode ? (
                  <Eye size={14} strokeWidth={1.75} />
                ) : (
                  <EyeOff size={14} strokeWidth={1.75} />
                )}
                {previewMode ? 'Showing all' : 'Show all'}
              </button>

              {/* Add Text */}
              <button
                onClick={onAddText}
                className="inline-flex items-center justify-center gap-1.5 h-[28px] text-[12px] text-text-secondary hover:text-text-primary hover:bg-app-hover rounded-md transition-colors"
                style={{ border: '0.5px solid var(--color-border)' }}
                title="Add text to scene"
              >
                <Type size={14} strokeWidth={1.75} />
                Add text
              </button>

              {/* Aspect picker */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-text-dim uppercase tracking-wider">Aspect</span>
                <div className="flex items-center gap-1.5">
                  {ASPECT_PRESETS.map((preset) => {
                    const active = activeAspectId === preset.id;
                    const inner =
                      preset.id === 'landscape'
                        ? { width: 18, height: 10 }
                        : preset.id === 'portrait'
                        ? { width: 10, height: 18 }
                        : { width: 14, height: 14 };
                    return (
                      <button
                        key={preset.id}
                        onClick={() => onSetAspect(preset.viewBox)}
                        title={`${preset.label} (${preset.id})`}
                        className="flex items-center justify-center rounded-sm transition-colors"
                        style={{
                          width: 28,
                          height: 28,
                          background: 'var(--color-app-base, #ffffff)',
                          border: active
                            ? '1.5px solid var(--color-accent)'
                            : '0.5px solid var(--color-border)',
                        }}
                      >
                        <span
                          style={{
                            ...inner,
                            background: active
                              ? 'var(--color-accent)'
                              : 'var(--color-text-secondary, #6b7280)',
                            borderRadius: 1,
                            display: 'block',
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Background picker */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-text-dim uppercase tracking-wider">Background</span>
                <div className="flex items-center gap-1.5">
                  {(['white', 'lined', 'grid', 'chalkboard'] as const).map((bg) => {
                    const active = background === bg;
                    const fill =
                      bg === 'chalkboard' ? '#1f2937' : '#ffffff';
                    return (
                      <button
                        key={bg}
                        onClick={() => onSetBackground(bg)}
                        title={bg}
                        className="rounded-sm transition-colors"
                        style={{
                          width: 28,
                          height: 28,
                          background: fill,
                          border: active
                            ? '1.5px solid var(--color-accent)'
                            : '0.5px solid var(--color-border)',
                          backgroundImage:
                            bg === 'lined'
                              ? 'repeating-linear-gradient(to bottom, transparent 0 5px, #e5e7eb 5px 6px)'
                              : bg === 'grid'
                              ? 'repeating-linear-gradient(to bottom, transparent 0 5px, #e5e7eb 5px 6px), repeating-linear-gradient(to right, transparent 0 5px, #e5e7eb 5px 6px)'
                              : undefined,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Speed slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-dim uppercase tracking-wider">Speed</span>
                  <span className="text-[11px] text-text-secondary tabular-nums">{speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.25}
                  value={speed}
                  onChange={(e) => onSetSpeed(parseFloat(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-text-dim">
                  <span>0.25x</span>
                  <span>1x</span>
                  <span>3x</span>
                </div>
              </div>

              {/* Status line */}
              <div className="flex flex-col gap-1 mt-1 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-dim">Asset</span>
                  <span className="text-text-secondary tabular-nums">
                    {currentAssetNumber} / {totalAssets}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-dim">Stroke</span>
                  <span className="text-text-secondary tabular-nums">
                    {currentStrokeInAsset} / {currentAssetStrokeCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-text-dim">Elapsed</span>
                  <span className="text-text-secondary tabular-nums">
                    {elapsed.toFixed(1)}s / {totalDuration.toFixed(1)}s
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            className="w-[4px] shrink-0 cursor-col-resize hover:bg-accent/30 transition-colors"
            onMouseDown={onResizeStart}
          />
        </>
      )}
    </div>
  );
}
