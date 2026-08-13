import { Button, Panel, StatusBadge } from '@shared/components';

function truncatePath(p: string, maxLen = 46): string {
  if (!p) return '(no folder)';
  if (p.length <= maxLen) return p;
  return `${p.slice(0, 16)}…${p.slice(-26)}`;
}

interface ImageLibraryHeaderProps {
  folder: string;
  cliInstalled: boolean;
  onChangeFolder: () => void;
  onOpenFolder: () => void;
  onRescan: () => void;
  onImport: () => void;
}

export function ImageLibraryHeader({
  folder,
  cliInstalled,
  onChangeFolder,
  onOpenFolder,
  onRescan,
  onImport,
}: ImageLibraryHeaderProps) {
  return (
    <Panel className="p-3 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] text-text-muted mb-0.5">Models folder</div>
          <div className="text-[12px] text-text-secondary font-mono truncate" title={folder}>
            {truncatePath(folder)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge tone={cliInstalled ? 'success' : 'warn'}>
            {cliInstalled ? 'sd-cli ready' : 'sd-cli not installed'}
          </StatusBadge>
          <Button variant="secondary" size="sm" onClick={onChangeFolder}>Change</Button>
          <Button variant="secondary" size="sm" onClick={onOpenFolder}>Open folder</Button>
          <Button variant="secondary" size="sm" onClick={onRescan}>Rescan</Button>
          <Button variant="primary" size="sm" onClick={onImport}>Import…</Button>
        </div>
      </div>
    </Panel>
  );
}
