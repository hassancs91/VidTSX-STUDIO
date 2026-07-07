export function TitleBar() {
  return (
    <div
      className="h-8 bg-app-deep flex items-center justify-center gap-1.5"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <img src="/icon.png" alt="" width={16} height={16} style={{ display: 'block' }} />
      <span className="text-text-muted" style={{ fontSize: '11px' }}>
        VidTSX Studio
      </span>
    </div>
  );
}
