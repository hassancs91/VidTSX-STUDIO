import { Cpu } from 'lucide-react';
import type { GpuProxyOffer } from '../hooks/useGpuProxyOffer';
import { gpuProxyOfferBody } from '../services/gpu-proxy-offer';

/**
 * The first-4K-import download card (A4, plan §2 T7). Floats bottom-left so
 * it never stacks on the toasts / crash prompt (bottom-right). Download runs
 * the same install as Settings › Rendering; "Not now" holds for the session.
 */
export function GpuProxyOfferCard({ offer }: { offer: GpuProxyOffer }) {
  if (!offer.visible || !offer.status) return null;
  const { phase, status, percent, error, outcome } = offer;
  const downloading = phase === 'downloading';

  return (
    <div
      className="fixed bottom-10 left-4 z-50 w-[360px] rounded-[8px] bg-app-active p-3 shadow-lg"
      style={{ border: '0.5px solid var(--color-border)' }}
      role="dialog"
      aria-label="GPU proxy encoder"
      data-gpu-proxy-offer={phase}
    >
      <div className="flex items-start gap-2">
        <Cpu size={14} strokeWidth={1.75} className="mt-[1px] shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium text-text-primary">
            {phase === 'done' ? 'GPU encoder downloaded' : '4K footage: build previews on the graphics card?'}
          </div>
          {phase !== 'done' && (
            <div className="mt-1 text-[10px] leading-snug text-text-muted" data-gpu-proxy-offer-body>
              {gpuProxyOfferBody(status.downloadBytes, status.licence)}
            </div>
          )}
          {outcome && (
            <div
              className={`mt-1 text-[10px] leading-snug ${outcome.ok ? 'text-text-muted' : 'text-amber-400'}`}
              data-gpu-proxy-offer-outcome={outcome.ok ? 'ok' : 'warn'}
            >
              {outcome.text}
            </div>
          )}
          {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
          <div className="mt-2 flex items-center gap-2">
            {phase === 'done' ? (
              <button
                type="button"
                onClick={offer.close}
                className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
                data-gpu-proxy-offer-close
              >
                OK
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void offer.download()}
                  className="rounded-[6px] bg-accent px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                  data-gpu-proxy-offer-download
                >
                  {downloading ? `Downloading… ${percent !== null ? `${Math.round(percent)}%` : ''}` : 'Download'}
                </button>
                <button
                  type="button"
                  disabled={downloading}
                  onClick={offer.dismiss}
                  className="rounded-[6px] px-2.5 py-1 text-[11px] text-text-muted hover:text-text-primary disabled:opacity-60"
                  data-gpu-proxy-offer-dismiss
                >
                  Not now
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
