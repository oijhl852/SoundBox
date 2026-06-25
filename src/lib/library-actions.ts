import type { FolderNode, LibrarySnapshot, MiniWaveformMap } from "@/lib/types";

export function shouldApplyLibraryResult(
  requestId: number,
  currentRequestId: number,
  targetPath: string,
  activePath: string
): boolean {
  return requestId === currentRequestId && targetPath === activePath;
}

export function shouldTriggerBackgroundIndex(snapshot: LibrarySnapshot): boolean {
  return !snapshot.indexingComplete;
}

/**
 * 从快照树递归收集文件路径，匹配 contentId → peaks 映射。
 * 纯函数，可独立测试。
 */
export function buildPrefilledWaveformMap(
  tree: FolderNode,
  peaksByContentId: Record<string, number[]>
): MiniWaveformMap {
  const result: MiniWaveformMap = {};

  function collect(node: FolderNode, baseName: string) {
    if (node.type === "file" && node.contentId && peaksByContentId[node.contentId]?.length) {
      result[baseName + "/" + node.name] = peaksByContentId[node.contentId];
    } else if (node.children) {
      const prefix = baseName ? baseName + "/" + node.name : node.name;
      for (const child of node.children) collect(child, prefix);
    }
  }

  collect(tree, "");
  return result;
}
