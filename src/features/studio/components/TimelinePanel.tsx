import type { StudioProject } from '../types';

const RULER_SECONDS = 60;
const PX_PER_SECOND = 20;

/** Static timeline scaffold — ruler + track lanes from the document. Clip
 *  rendering, scrubbing, and editing tools arrive in Phase S2. */
export function TimelinePanel({ project }: { project: StudioProject }) {
  const tracks = project.timeline.tracks;

  return (
    <div
      className="h-[210px] shrink-0 flex flex-col bg-app-deep"
      style={{ borderTop: '0.5px solid var(--color-border)' }}
    >
      <div
        className="flex items-center justify-between h-[28px] px-2.5 shrink-0"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        <span className="text-[11px] font-mono text-text-muted">00:00.00</span>
        <span className="text-[10px] text-text-ghost">
          Timeline editing arrives in Phase S2
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full" style={{ width: RULER_SECONDS * PX_PER_SECOND + 64 }}>
          {/* Ruler */}
          <div className="flex h-[20px] sticky top-0 bg-app-deep" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
            <div className="w-[64px] shrink-0" style={{ borderRight: '0.5px solid var(--color-border)' }} />
            <div className="relative flex-1">
              {Array.from({ length: RULER_SECONDS / 5 + 1 }, (_, i) => (
                <span
                  key={i}
                  className="absolute top-[3px] text-[9px] text-text-ghost select-none"
                  style={{ left: i * 5 * PX_PER_SECOND + 2 }}
                >
                  {formatTick(i * 5)}
                </span>
              ))}
            </div>
          </div>

          {/* Track lanes */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex h-[42px]"
              style={{ borderBottom: '0.5px solid var(--color-border)' }}
            >
              <div
                className="w-[64px] shrink-0 flex items-center px-2 bg-app-surface"
                style={{ borderRight: '0.5px solid var(--color-border)' }}
              >
                <span className="text-[10px] font-medium text-text-muted">{track.name}</span>
              </div>
              <div className="flex-1 bg-app-base/40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatTick(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
