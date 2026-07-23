import { useEffect, useState } from 'react';

export function AppInfoSection() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.api.appGetInfo().then((info) => {
      if (!cancelled) setVersion(info.version);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-app-surface rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2">
        <div className="text-[12px] text-text-secondary">
          VidTSX Studio v{version || '…'}
        </div>
        <span
          className="text-accent-light"
          style={{
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.5px',
            padding: '1px 5px',
            borderRadius: '3px',
            border: '0.5px solid var(--color-accent-light)',
            lineHeight: 1,
          }}
        >
          BETA
        </span>
      </div>
    </div>
  );
}
