interface Props {
  width: number;
  height: number;
}

/** Aspect-correct preview stage. The Remotion Player mounts here in Phase S2 —
 *  for now it renders the empty canvas at the project's aspect ratio. */
export function PreviewPanel({ width, height }: Props) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center bg-app-player p-4">
      <div
        className="relative bg-black rounded-[4px] flex items-center justify-center"
        style={{
          aspectRatio: `${width} / ${height}`,
          maxWidth: '100%',
          maxHeight: '100%',
          width: width >= height ? '100%' : 'auto',
          height: width >= height ? 'auto' : '100%',
          border: '0.5px solid var(--color-border)',
        }}
      >
        <span className="text-[11px] text-text-ghost select-none">
          {width}×{height} — preview arrives in Phase S2
        </span>
      </div>
    </div>
  );
}
