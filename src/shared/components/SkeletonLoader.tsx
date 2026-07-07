interface SkeletonLoaderProps {
  variant: 'generating' | 'loading';
}

export function SkeletonLoader({ variant }: SkeletonLoaderProps) {
  const isGenerating = variant === 'generating';

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {isGenerating ? (
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-accent"
              style={{
                animation: 'skeleton-dot-bounce 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin"
          role="status"
          aria-label="Loading"
        />
      )}
      <span className="text-[11px] text-text-dim tracking-wide">
        {isGenerating ? 'Composing your video…' : 'Loading preview…'}
      </span>
    </div>
  );
}
