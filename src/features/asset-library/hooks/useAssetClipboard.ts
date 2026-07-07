import { useCallback } from 'react';
import { useToast } from '@renderer/contexts/ToastContext';
import { normalizeForStaticFile } from '../services/asset-paths';

// Build a relative URL that resolves at runtime against whichever origin loaded
// the bundle. Works in BOTH the live preview (module server :3200) and the
// renderer (bundler :3100) because both expose `/asset?path=...`. Crucially
// this avoids `staticFile()`, which Remotion's renderer rejects for absolute
// paths — the staticFile override only patches the preview context.
function buildAssetUrl(absolutePath: string): string {
  return `/asset?path=${encodeURIComponent(normalizeForStaticFile(absolutePath))}`;
}

export function useAssetClipboard() {
  const { showToast } = useToast();

  // Default action: copy the URL ready to drop into `<OffthreadVideo src={...} />`
  // or any other src/href. The path is encoded so spaces and unicode round-trip.
  const copyAssetUrl = useCallback(async (absolutePath: string) => {
    try {
      await navigator.clipboard.writeText(buildAssetUrl(absolutePath));
      showToast('Asset URL copied — paste into a `src` prop', 'success');
    } catch {
      showToast('Failed to copy URL', 'error');
    }
  }, [showToast]);

  // Secondary action: the raw filesystem path for cases where the user needs
  // it as data (filenames, metadata, scripts). Forward-slashed for clean
  // pasting into JS string literals on Windows.
  const copyRawPath = useCallback(async (absolutePath: string) => {
    try {
      await navigator.clipboard.writeText(normalizeForStaticFile(absolutePath));
      showToast('File path copied', 'success');
    } catch {
      showToast('Failed to copy path', 'error');
    }
  }, [showToast]);

  return { copyAssetUrl, copyRawPath };
}
