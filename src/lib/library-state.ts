import type {
  FileMeta,
  FolderNode,
  LibraryLoadState,
  LibrarySnapshot,
  MiniWaveformMap,
  TagEntry,
} from "@/lib/types";

type DerivedLibraryState = {
  folderTree: FolderNode[];
  expandedFolders: Set<string>;
  selectedFolderPath: string;
  files: FileMeta[];
  tagsByPath: Record<string, TagEntry[]>;
  miniWaveforms: MiniWaveformMap;
  libraryLoadState: LibraryLoadState;
};

export function deriveLibraryStateFromSnapshot(
  snapshot: LibrarySnapshot,
  previousMiniWaveforms: MiniWaveformMap,
  previousSelectedFolderPath?: string | null
): DerivedLibraryState {
  const tree = snapshot.tree;
  const tagsByContentId = snapshot.localTags?.contents ?? {};
  const tagsByPath: Record<string, TagEntry[]> = {};
  const files: FileMeta[] = [];

  const collectFiles = (node: FolderNode, folderName: string) => {
    for (const file of node.files) {
      files.push({ name: file.name, path: file.path, folder: folderName, contentId: file.contentId });
      if (file.contentId && tagsByContentId[file.contentId]) {
        const tagList: TagEntry[] = [];
        for (const [group, entries] of Object.entries(tagsByContentId[file.contentId].tags as Record<string, TagEntry[]>)) {
          tagList.push(...entries.map((entry) => ({ ...entry, group })));
        }
        tagsByPath[file.path] = tagList;
      }
    }

    for (const child of node.children) {
      collectFiles(child, child.name);
    }
  };

  collectFiles(tree, tree.name);

  const miniWaveforms: MiniWaveformMap = {};
  for (const file of files) {
    if (previousMiniWaveforms[file.path]?.length) {
      miniWaveforms[file.path] = previousMiniWaveforms[file.path];
    }
  }

  return {
    folderTree: [tree],
    expandedFolders: new Set([tree.path]),
    selectedFolderPath:
      previousSelectedFolderPath && previousSelectedFolderPath.startsWith(tree.path)
        ? previousSelectedFolderPath
        : tree.path,
    files,
    tagsByPath,
    miniWaveforms,
    libraryLoadState: {
      status: snapshot.indexingComplete ? "ready" : "indexing",
      usedCache: snapshot.usedCache,
      indexingComplete: snapshot.indexingComplete,
      message: snapshot.usedCache
        ? "已从本地索引恢复素材列表"
        : snapshot.indexingComplete
          ? "已完成完整索引构建"
          : "已加载目录和文件列表，正在后台补建索引...",
    },
  };
}
