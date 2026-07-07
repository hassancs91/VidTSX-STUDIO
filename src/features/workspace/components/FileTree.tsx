import { useState, useCallback } from "react";
import type { TreeNode, FileNode } from "../types";
import { FileTreeItem } from "./FileTreeItem";
import { InlineRenameInput } from "./InlineRenameInput";

interface FileTreeProps {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelectFile: (file: FileNode) => void;
  onRename?: (oldPath: string, newName: string) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (path: string, recursive?: boolean) => Promise<{ success: boolean; error?: string }>;
  onCreateSubfolder?: (name: string, parentPath: string) => Promise<{ success: boolean; error?: string }>;
  onMove?: (sourcePath: string, targetFolderPath: string) => Promise<{ success: boolean; error?: string }>;
}

export function FileTree({
  nodes,
  selectedId,
  onSelectFile,
  onRename,
  onDelete,
  onCreateSubfolder,
  onMove,
}: FileTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingSubfolderId, setCreatingSubfolderId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContextMenu = useCallback(
    async (e: React.MouseEvent, node: TreeNode) => {
      e.preventDefault();
      e.stopPropagation();

      const result = await window.api.contextMenuShow({
        target: {
          type: node.type,
          path: node.path,
          name: node.name,
        },
      });

      if (result.action === "rename") {
        setRenamingId(node.id);
      } else if (result.action === "delete") {
        if (onDelete) {
          const recursive = node.type === "folder";
          await onDelete(node.path, recursive);
        }
      } else if (result.action === "new-subfolder" && node.type === "folder") {
        // Expand the folder and show inline input for new subfolder
        setExpandedIds((prev) => new Set(prev).add(node.id));
        setCreatingSubfolderId(node.id);
      }
    },
    [onDelete]
  );

  const handleRename = useCallback(
    async (node: TreeNode, newName: string) => {
      setRenamingId(null);
      if (onRename && newName !== node.name) {
        await onRename(node.path, newName);
      }
    },
    [onRename]
  );

  const handleCreateSubfolder = useCallback(
    async (parentPath: string, name: string) => {
      setCreatingSubfolderId(null);
      if (onCreateSubfolder && name.trim()) {
        await onCreateSubfolder(name.trim(), parentPath);
      }
    },
    [onCreateSubfolder]
  );

  const handleDragStart = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.dataTransfer.setData("text/plain", node.path);
    e.dataTransfer.effectAllowed = "move";
    setDraggingPath(node.path);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (node.type === "folder" && draggingPath !== node.path) {
      e.dataTransfer.dropEffect = "move";
      setDragOverId(node.id);
    }
  }, [draggingPath]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetNode: TreeNode) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
      setDraggingPath(null);

      if (targetNode.type !== "folder") return;

      const sourcePath = e.dataTransfer.getData("text/plain");
      if (!sourcePath || sourcePath === targetNode.path) return;

      // Don't allow dropping a folder into itself or its children
      if (targetNode.path.startsWith(sourcePath + "/") || targetNode.path.startsWith(sourcePath + "\\")) {
        return;
      }

      if (onMove) {
        await onMove(sourcePath, targetNode.path);
      }
    },
    [onMove]
  );

  const handleDragEnd = useCallback(() => {
    setDragOverId(null);
    setDraggingPath(null);
  }, []);

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const isRenaming = renamingId === node.id;

    return (
      <div key={node.id}>
        {isRenaming ? (
          <div
            className="flex items-center gap-[6px] py-[4px] pr-[10px]"
            style={{ paddingLeft: 10 + depth * 14 + (node.type === "folder" ? 16 : 0) }}
          >
            <InlineRenameInput
              initialName={node.name}
              onSave={(newName) => handleRename(node, newName)}
              onCancel={() => setRenamingId(null)}
            />
          </div>
        ) : (
          <FileTreeItem
            node={node}
            depth={depth}
            isSelected={isSelected}
            isExpanded={isExpanded}
            isDragOver={dragOverId === node.id}
            onSelect={() => {
              if (node.type === "file") {
                onSelectFile(node);
              }
            }}
            onToggle={() => {
              if (node.type === "folder") {
                toggleExpanded(node.id);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, node)}
            onDragStart={(e) => handleDragStart(e, node)}
            onDragOver={(e) => handleDragOver(e, node)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node)}
          />
        )}
        {node.type === "folder" && isExpanded && (
          <div>
            {creatingSubfolderId === node.id && (
              <div
                className="flex items-center gap-[6px] py-[4px] pr-[10px]"
                style={{ paddingLeft: 10 + (depth + 1) * 14 + 16 }}
              >
                <InlineRenameInput
                  initialName=""
                  onSave={(name) => handleCreateSubfolder(node.path, name)}
                  onCancel={() => setCreatingSubfolderId(null)}
                />
              </div>
            )}
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-1" onDragEnd={handleDragEnd}>
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  );
}
