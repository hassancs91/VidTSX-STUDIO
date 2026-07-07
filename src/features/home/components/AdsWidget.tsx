import type { AdItem } from '../../../shared/ipc/types';

interface AdsWidgetProps {
  ads: AdItem[];
}

function openExternal(url: string) {
  window.api.appOpenExternal({ url });
}

function AdCard({ ad }: { ad: AdItem }) {
  const accent = ad.accentColor || 'var(--color-accent)';
  const showTopImage = ad.image && ad.image.position !== 'background';
  const showBackgroundImage = ad.image?.position === 'background';

  return (
    <div
      className="bg-app-surface rounded-[8px] overflow-hidden relative"
      style={{ border: '0.5px solid var(--color-border)' }}
    >
      <div className="h-[2px]" style={{ backgroundColor: accent }} />

      {showTopImage && (
        <img
          src={ad.image!.url}
          alt={ad.image!.alt}
          className="w-full h-[100px] object-cover"
          loading="lazy"
        />
      )}

      {showBackgroundImage && (
        <img
          src={ad.image!.url}
          alt={ad.image!.alt}
          className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          loading="lazy"
        />
      )}

      <div className="p-3 flex flex-col gap-2 relative">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-primary font-medium">
            {ad.title}
          </span>
          <span className="text-[8px] text-text-dim uppercase tracking-wider">
            {ad.label ?? 'Sponsored'}
          </span>
        </div>

        {ad.body && (
          <p className="text-[10px] text-text-dim leading-relaxed">{ad.body}</p>
        )}

        {ad.cta && (
          <button
            onClick={() => openExternal(ad.cta!.url)}
            className="text-white rounded-[6px] px-[10px] py-[4px] text-[11px] hover:opacity-90 cursor-pointer self-start mt-1 transition-opacity duration-150"
            style={{ backgroundColor: accent }}
          >
            {ad.cta.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function AdsWidget({ ads }: AdsWidgetProps) {
  return (
    <div className="flex flex-col gap-3">
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </div>
  );
}
