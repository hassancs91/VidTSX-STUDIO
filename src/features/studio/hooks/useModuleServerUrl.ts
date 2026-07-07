import { useEffect, useState } from 'react';

export function useModuleServerUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    window.api.moduleServerUrl().then((res) => {
      if (!cancelled) setUrl(res.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return url;
}

export function assetUrl(serverUrl: string | null, filePath: string): string | null {
  if (!serverUrl) return null;
  return `${serverUrl}/asset?path=${encodeURIComponent(filePath)}`;
}
