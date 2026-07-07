// Forward slashes round-trip cleanly through Node's path.resolve() on Windows
// and avoid the visual noise of backslash escaping when the user pastes into a
// TSX string. Always normalize before writing to the clipboard or surfacing in UI.
export function normalizeForStaticFile(absolutePath: string): string {
  return absolutePath.replaceAll('\\', '/');
}

// Compute breadcrumb segments for a path relative to the assets root. Returns
// `[]` when currentPath equals (or is outside) the root — the screen renders a
// single "Assets" crumb in that case.
export function relativeSegments(currentPath: string, rootPath: string): string[] {
  if (!currentPath || !rootPath) return [];
  const cur = currentPath.replaceAll('\\', '/').replace(/\/$/, '');
  const root = rootPath.replaceAll('\\', '/').replace(/\/$/, '');
  if (cur === root || !cur.startsWith(root + '/')) return [];
  return cur.slice(root.length + 1).split('/').filter(Boolean);
}

// Reconstruct an absolute path by joining the assets root with the first N
// breadcrumb segments. Used by AssetBreadcrumb to navigate to an ancestor when
// the user clicks a crumb.
export function joinSegments(rootPath: string, segments: string[]): string {
  if (segments.length === 0) return rootPath;
  const sep = rootPath.includes('\\') ? '\\' : '/';
  return rootPath.replace(/[\\/]$/, '') + sep + segments.join(sep);
}
