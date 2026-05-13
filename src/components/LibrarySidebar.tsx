import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Database, Folder, Library, Loader2 } from "lucide-react";
import { useLibraryStore } from "@/stores/libraryStore";
import { useTagStore } from "@/stores/tagStore";
import { useUiStore } from "@/stores/uiStore";
import { collectFilesForFolder } from "@/lib/file-list-state";
import { collectVisibleTags } from "@/lib/file-filtering";
import { useMemo } from "react";
import type { FolderNode } from "@/lib/types";

interface LibrarySidebarProps {
  visible: boolean;
  sidebarWidth: number;
}

export function LibrarySidebar({ visible, sidebarWidth }: LibrarySidebarProps) {
  const libraries = useLibraryStore((s) => s.libraries);
  const activeLibrary = useLibraryStore((s) => s.activeLibrary);
  const folderTree = useLibraryStore((s) => s.folderTree);
  const selectedFolderPath = useLibraryStore((s) => s.selectedFolderPath);
  const expandedFolders = useLibraryStore((s) => s.expandedFolders);
  const libraryLoadState = useLibraryStore((s) => s.libraryLoadState);
  const libTags = useLibraryStore((s) => s.tags);
  const nameSuggestions = useLibraryStore((s) => s.nameSuggestions);
  const selectLibrary = useLibraryStore((s) => s.selectLibrary);
  const toggleFolder = useLibraryStore((s) => s.toggleFolder);
  const setSelectedFolderPath = useLibraryStore((s) => s.setSelectedFolderPath);
  const setIsResizingSidebar = useUiStore((s) => s.setIsResizingSidebar);
  const tagFilters = useTagStore((s) => s.tagFilters);
  const toggleTagFilter = useTagStore((s) => s.toggleTagFilter);
  const setTagFilters = useTagStore((s) => s.setTagFilters);

  // 派生数据：当前可见文件列表中的唯一标签
  const computedUniqueTags = useMemo(() => {
    const visibleFiles = collectFilesForFolder(folderTree, selectedFolderPath);
    return collectVisibleTags({
      visibleFiles,
      tags: libTags,
      nameSuggestions,
    });
  }, [folderTree, selectedFolderPath, libTags, nameSuggestions]);

  if (!visible) return null;

  const renderFolderTree = (node: FolderNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const hasChildren = node.children.length > 0;
    const isSelected = selectedFolderPath === node.path;
    return (
      <div key={node.path}>
        <button
          onClick={() => setSelectedFolderPath(node.path)}
          className={`flex w-full items-center rounded px-2 py-1 text-sm transition-colors ${isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent"}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <span
            className="mr-1 flex h-3 w-3 items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleFolder(node.path);
            }}
          >
            {hasChildren ? (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />) : null}
          </span>
          <Folder className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="truncate">{node.name}</span>
          {node.files.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{node.files.length}</span>}
        </button>
        {isExpanded && node.children.map((child) => renderFolderTree(child, level + 1))}
      </div>
    );
  };

  return (
    <>
      <aside className="border-r bg-muted/30 flex flex-col shrink-0" style={{ width: sidebarWidth }}>
        <div className="border-b">
          <div className="p-2 flex items-center gap-2">
            <Library className="h-4 w-4" />
            <span className="text-sm font-medium">素材库</span>
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {libraries.map((lib) => (
              <Badge
                key={lib.path}
                variant={activeLibrary === lib.path ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => selectLibrary(lib.path)}
              >
                {lib.name}
              </Badge>
            ))}
          </div>
          <div className="px-2 pb-2 text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1">
              <Database className="h-3.5 w-3.5" />
              <span>{libraryLoadState.message ?? "等待加载素材库"}</span>
            </div>
            {libraryLoadState.status === "ready" && (
              <div>{libraryLoadState.usedCache ? "当前使用本地索引缓存" : "当前为首次索引结果"}</div>
            )}
            {libraryLoadState.status === "indexing" && (
              <div>
                {libraryLoadState.indexingComplete
                  ? "正在刷新界面..."
                  : "目录和文件已可浏览，完整索引仍在生成。"}
              </div>
            )}
          </div>
        </div>

        {computedUniqueTags.length > 0 && (
          <div className="px-2 pb-2 border-b">
            <div className="text-xs text-muted-foreground mb-1 px-2">标签筛选</div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {computedUniqueTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tagFilters.has(tag) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => toggleTagFilter(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            {tagFilters.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 text-xs"
                onClick={() => setTagFilters(new Set())}
              >
                清除筛选
              </Button>
            )}
          </div>
        )}

        <div className="px-2 flex-1 overflow-y-auto">
          {folderTree.length > 0 ? (
            <>
              {libraryLoadState.status === "indexing" && (
                <div className="px-2 py-2 flex items-center gap-2 text-xs text-muted-foreground sticky top-0 bg-muted/30 z-10">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>正在后台补建索引，目录可先浏览。</span>
                </div>
              )}
              {folderTree.map((node) => renderFolderTree(node))}
            </>
          ) : (
            <p className="px-2 py-4 text-sm text-muted-foreground text-center">
              {libraryLoadState.message ?? "请在设置中添加素材库"}
            </p>
          )}
        </div>
      </aside>
      <div
        className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40 shrink-0"
        onMouseDown={() => setIsResizingSidebar(true)}
      />
    </>
  );
}
