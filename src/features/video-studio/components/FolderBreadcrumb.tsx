interface FolderBreadcrumbProps {
  folderName: string;
  onNavigateRoot: () => void;
}

export function FolderBreadcrumb({ folderName, onNavigateRoot }: FolderBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 text-[12px]">
      <button
        type="button"
        className="text-text-dim hover:text-accent transition-colors"
        onClick={onNavigateRoot}
      >
        All Videos
      </button>
      <span className="text-text-dim">/</span>
      <span className="text-text-primary font-medium truncate max-w-[150px]">
        {folderName}
      </span>
    </div>
  );
}
