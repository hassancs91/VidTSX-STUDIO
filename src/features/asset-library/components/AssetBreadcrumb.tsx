import { joinSegments, relativeSegments } from '../services/asset-paths';

interface AssetBreadcrumbProps {
  rootPath: string;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function AssetBreadcrumb({ rootPath, currentPath, onNavigate }: AssetBreadcrumbProps) {
  const segments = relativeSegments(currentPath, rootPath);

  return (
    <nav className="flex items-center gap-1 text-[12px] text-text-muted overflow-x-auto">
      <button
        type="button"
        onClick={() => onNavigate(rootPath)}
        className={`
          px-2 py-0.5 rounded hover:bg-app-hover
          ${segments.length === 0 ? 'text-text-primary' : 'text-text-secondary'}
        `}
      >
        Assets
      </button>
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const targetPath = joinSegments(rootPath, segments.slice(0, idx + 1));
        return (
          <span key={targetPath} className="flex items-center gap-1">
            <span className="text-text-dim">/</span>
            <button
              type="button"
              onClick={() => onNavigate(targetPath)}
              className={`
                px-2 py-0.5 rounded hover:bg-app-hover whitespace-nowrap
                ${isLast ? 'text-text-primary' : 'text-text-secondary'}
              `}
            >
              {seg}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
