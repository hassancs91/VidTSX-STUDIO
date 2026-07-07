import { useRef, useEffect, useState } from 'react';
import type { CompositionMetadata } from '@shared/ipc/types';

interface BundlePreviewProps {
  serveUrl: string;
  composition: CompositionMetadata;
  className?: string;
}

function LoadingSpinner() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div
        className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"
        role="status"
      />
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="text-center">
        <div className="text-accent-red text-[12px] font-medium mb-1">
          Preview Error
        </div>
        <div className="text-text-dim text-[11px] max-w-[300px]">{message}</div>
      </div>
    </div>
  );
}

export function BundlePreview({ serveUrl, composition, className = '' }: BundlePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Construct the preview URL using hash routing (Remotion Studio format)
  // The bundle's router interprets hash paths as composition IDs
  const previewUrl = `${serveUrl}/#/${encodeURIComponent(composition.id)}`;

  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [previewUrl]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load composition preview');
  };

  return (
    <div className={`relative bg-app-player rounded-lg overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-app-player z-10">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-app-player z-10">
          <ErrorDisplay message={error} />
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={previewUrl}
        className="w-full h-full border-0"
        style={{
          aspectRatio: `${composition.width}/${composition.height}`,
        }}
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-scripts allow-same-origin"
        title="Composition Preview"
      />
    </div>
  );
}
