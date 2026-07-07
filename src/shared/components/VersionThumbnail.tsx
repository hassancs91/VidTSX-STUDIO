import { useEffect } from 'react';

interface VersionThumbnailProps {
  tsxFilePath: string;
  loadThumbnail: (path: string) => Promise<string | null>;
  getThumbnail: (path: string) => string | null;
}

export function VersionThumbnail({ tsxFilePath, loadThumbnail, getThumbnail }: VersionThumbnailProps) {
  useEffect(() => {
    loadThumbnail(tsxFilePath);
  }, [tsxFilePath, loadThumbnail]);

  const dataUrl = getThumbnail(tsxFilePath);
  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt=""
      className="shrink-0 rounded-[2px]"
      style={{ width: 28, height: 16, objectFit: 'cover' }}
    />
  );
}
