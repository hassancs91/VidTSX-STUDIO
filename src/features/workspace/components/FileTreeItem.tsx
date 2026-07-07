import type { TreeNode } from "../types";

interface FileTreeItemProps {
  node: TreeNode;
  depth: number;
  isSelected: boolean;
  isExpanded?: boolean;
  isDragOver?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const iconProps = {
  width: 14,
  height: 14,
  fill: "none",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const FolderClosedIcon = () => (
  <svg {...iconProps} viewBox="0 0 14 14" stroke="currentColor">
    <path d="M1.5 3.5V11C1.5 11.55 1.95 12 2.5 12H11.5C12.05 12 12.5 11.55 12.5 11V5C12.5 4.45 12.05 4 11.5 4H7L5.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5Z" />
  </svg>
);

const FolderOpenIcon = () => (
  <svg {...iconProps} viewBox="0 0 14 14" stroke="currentColor">
    <path d="M1.5 3.5V11C1.5 11.55 1.95 12 2.5 12H11.5C12.05 12 12.5 11.55 12.5 11V5C12.5 4.45 12.05 4 11.5 4H7L5.5 2.5H2.5C1.95 2.5 1.5 2.95 1.5 3.5Z" />
    <path d="M1.5 6H12.5" />
  </svg>
);

const FileIcon = () => (
  <svg {...iconProps} viewBox="0 0 14 14" stroke="currentColor">
    <path d="M8 1.5H3.5C2.95 1.5 2.5 1.95 2.5 2.5V11.5C2.5 12.05 2.95 12.5 3.5 12.5H10.5C11.05 12.5 11.5 12.05 11.5 11.5V5L8 1.5Z" />
    <path d="M8 1.5V5H11.5" />
  </svg>
);

const ChevronIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width={10}
    height={10}
    viewBox="0 0 10 10"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 150ms",
    }}
  >
    <path d="M3.5 2L6.5 5L3.5 8" />
  </svg>
);

export function FileTreeItem({
  node,
  depth,
  isSelected,
  isExpanded,
  isDragOver,
  onSelect,
  onToggle,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: FileTreeItemProps) {
  const isFolder = node.type === "folder";

  const handleClick = () => {
    if (isFolder && onToggle) {
      onToggle();
    } else {
      onSelect();
    }
  };

  const stateClasses = isSelected
    ? "bg-app-active text-accent-light"
    : isDragOver && isFolder
      ? "bg-accent/20 text-accent-light"
      : "text-text-primary hover:bg-app-hover";

  return (
    <div
      className={`flex items-center gap-[6px] py-[4px] pr-[10px] text-[12px] rounded-[4px] cursor-pointer transition-colors duration-150 ${stateClasses}`}
      style={{ paddingLeft: 10 + depth * 14 }}
      draggable
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={isFolder ? onDragOver : undefined}
      onDragLeave={isFolder ? onDragLeave : undefined}
      onDrop={isFolder ? onDrop : undefined}
    >
      {isFolder && (
        <span className="text-text-dim">
          <ChevronIcon expanded={isExpanded ?? false} />
        </span>
      )}
      <span className={isSelected ? "text-accent-light" : "text-text-secondary"}>
        {isFolder ? (
          isExpanded ? (
            <FolderOpenIcon />
          ) : (
            <FolderClosedIcon />
          )
        ) : (
          <FileIcon />
        )}
      </span>
      <span>{node.name}</span>
    </div>
  );
}
