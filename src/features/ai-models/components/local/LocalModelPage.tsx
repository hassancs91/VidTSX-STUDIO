import type { ReactNode } from 'react';
import { ErrorBanner } from '@shared/components';
import type { LibraryError } from '../../hooks/useImageLibrary';

interface LocalModelPageProps {
  /** The status strip (runtime chip + models folder). */
  strip: ReactNode;
  /** Anything that sits right under the strip (the Video generate panel until P3b). */
  lead?: ReactNode;
  /** The Defaults row, where the page owns one (Audio). */
  defaults?: ReactNode;
  installed: ReactNode;
  recommended?: ReactNode;
  all?: ReactNode;
  /** Extra panels after the catalog (Image tools). */
  extras?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  error?: LibraryError | null;
  onClearError?: () => void;
  /** Dialogs and other portals. */
  children?: ReactNode;
}

/**
 * The shared layout of every local-model section (docs/ai-models-redesign.md
 * §3.3): status strip → Defaults → Installed → Recommended → All models, in
 * that order, full width. Pages supply the panels; this keeps the order and
 * the loading / error treatment identical across Image, Video, Audio and 3D.
 */
export function LocalModelPage({
  strip,
  lead,
  defaults,
  installed,
  recommended,
  all,
  extras,
  loading,
  loadingLabel,
  error,
  onClearError,
  children,
}: LocalModelPageProps) {
  return (
    <div data-local-page>
      {strip}
      {loading ? (
        <div className="p-4 text-center text-[12px] text-text-muted">{loadingLabel ?? 'Scanning models folder…'}</div>
      ) : (
        <div className="flex flex-col gap-4">
          {lead}
          {defaults}
          {installed}
          {recommended}
          {all}
          {extras}
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error.message} details={error.details} onDismiss={onClearError} />
        </div>
      )}
      {children}
    </div>
  );
}
