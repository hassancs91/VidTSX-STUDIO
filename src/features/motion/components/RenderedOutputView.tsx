import { Button } from '@shared/components';
import { useRenderQueue, getFormatLabel, formatResolution, formatFileSize } from '@features/render-queue';
import type { RenderHistoryEntry } from '@shared/ipc/types';
import type { RenderedOutputs } from '../hooks/useRenderedOutputs';
import { GifPlayer } from './GifPlayer';

function describeRenderedEntry(entry: RenderHistoryEntry): string {
  const scale = entry.scale ?? 1;
  const codec = (entry.codec ?? 'h264') as 'h264';
  const parts = [getFormatLabel(codec)];
  if (typeof entry.width === 'number' && typeof entry.height === 'number') {
    parts.push(formatResolution(Math.round(entry.width * scale), Math.round(entry.height * scale)));
  }
  if (entry.fileSize) parts.push(formatFileSize(entry.fileSize));
  return parts.join(' · ');
}

interface RenderedOutputViewProps {
  outputs: RenderedOutputs;
  emptyText: string;
}

/** The Rendered tab: a picker over a file's finished renders and a player for the chosen one. */
export function RenderedOutputView({ outputs, emptyText }: RenderedOutputViewProps) {
  const { openFolder, openFile } = useRenderQueue();
  const { jobs, selectedIndex, setSelectedIndex, selected, src } = outputs;

  if (!src || !selected) {
    return (
      <div className="flex-1 min-h-0 flex flex-col m-2">
        <div className="flex-1 flex items-center justify-center bg-app-player rounded-lg">
          <span className="text-[12px] text-text-dim">{emptyText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col m-2">
      {/* Info bar with dropdown + open folder */}
      <div
        className="shrink-0 flex items-center gap-2 px-2 py-1.5 rounded-t-lg bg-app-surface"
        style={{ borderBottom: '0.5px solid var(--color-border)' }}
      >
        {jobs.length > 1 ? (
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="bg-app-base text-text-secondary text-[10px] rounded px-2 py-1 border-none outline-none cursor-pointer"
            style={{ border: '0.5px solid var(--color-border)' }}
          >
            {jobs.map((job, i) => (
              <option key={i} value={i}>{describeRenderedEntry(job)}</option>
            ))}
          </select>
        ) : (
          <span className="text-[10px] text-text-muted">
            {describeRenderedEntry(selected)}
          </span>
        )}
        <button
          onClick={() => openFolder(selected.outputPath)}
          className="ml-auto text-text-dim hover:text-text-primary transition-colors cursor-pointer p-1 rounded hover:bg-app-hover"
          title="Open file location"
        >
          <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h3.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H13.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9Z" />
          </svg>
        </button>
      </div>
      {/* Player area */}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-app-player rounded-b-lg overflow-hidden">
        {selected.codec === 'gif' ? (
          <GifPlayer
            key={src}
            src={src}
            className="w-full h-full"
          />
        ) : selected.codec === 'webp' ? (
          // Chromium plays animated WebP natively in an <img>.
          <img
            key={src}
            src={src}
            className="max-w-full max-h-full object-contain"
            alt="Rendered animated WebP"
          />
        ) : selected.codec === 'prores' ? (
          <div className="flex flex-col items-center justify-center text-center px-6 py-8 max-w-[420px]">
            <svg
              width={48}
              height={48}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-dim mb-3"
            >
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <path d="M10 10l4 2-4 2v-4z" fill="currentColor" />
            </svg>
            <div className="text-[13px] font-medium text-text-primary mb-2">
              ProRes preview not available in-app
            </div>
            <div className="text-[11px] text-text-dim mb-4 leading-relaxed">
              ProRes 4444 is a pro editor codec — your render is good and ready
              to use, but the in-app player can't decode it (only its audio
              track). Open it in your video editor (CapCut, Premiere, etc.)
              where transparency and quality will look correct.
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => openFile(selected.outputPath)}
              >
                Open in editor
              </Button>
              <Button
                variant="secondary"
                onClick={() => openFolder(selected.outputPath)}
              >
                Show in folder
              </Button>
            </div>
          </div>
        ) : (
          <video
            key={src}
            src={src}
            controls
            autoPlay={false}
            className="max-w-full max-h-full"
            style={{ objectFit: 'contain' }}
          />
        )}
      </div>
    </div>
  );
}
