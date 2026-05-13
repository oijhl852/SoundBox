import type { FileMeta, FolderNode } from "@/lib/types";

export function collectFilesForFolder(nodes: FolderNode[], folderPath: string | null): FileMeta[] {
  if (!folderPath) {
    return [];
  }

  const visit = (node: FolderNode): FileMeta[] | null => {
    if (node.path === folderPath) {
      return node.files.map((file) => ({
        name: file.name,
        path: file.path,
        folder: node.name,
        contentId: file.contentId,
      }));
    }

    for (const child of node.children) {
      const found = visit(child);
      if (found) {
        return found;
      }
    }

    return null;
  };

  for (const node of nodes) {
    const found = visit(node);
    if (found) {
      return found;
    }
  }

  return [];
}
