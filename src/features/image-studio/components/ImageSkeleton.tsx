import type { PendingGeneration } from '../types';

export function ImageSkeleton({ item }: { item: PendingGeneration }) {
  const aspectRatio = item.width / item.height;

  return (
    <div
      className="relative rounded-lg overflow-hidden bg-gradient-to-br from-app-surface via-app-base to-app-surface border border-border"
      style={{ aspectRatio }}
    >
      {/* Centered label with pulse */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[11px] text-accent-light font-medium px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm"
          style={{ animation: 'skeleton-pulse 2s ease-in-out infinite' }}
        >
          Generating...
        </span>
      </div>
    </div>
  );
}
