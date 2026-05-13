import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileAudio, Plus, X } from "lucide-react";
import { buildTagInspectorViewModel } from "@/lib/tag-inspector-state";
import { usePlayerStore } from "@/stores/playerStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { useTagStore, useCurrentFileMeta } from "@/stores/tagStore";
import { useMemo } from "react";
import { TAG_GROUPS } from "@/lib/app-constants";

export function TagInspector() {
  const currentFile = usePlayerStore((s) => s.currentFile);
  const contentIndex = useLibraryStore((s) => s.contentIndex);
  const syncStatus = useLibraryStore((s) => s.syncStatus);
  const libTags = useLibraryStore((s) => s.tags);
  const nameSuggestions = useLibraryStore((s) => s.nameSuggestions);

  const showTagEditor = useTagStore((s) => s.showTagEditor);
  const selectedTagGroup = useTagStore((s) => s.selectedTagGroup);
  const newTagValue = useTagStore((s) => s.newTagValue);
  const setShowTagEditor = useTagStore((s) => s.setShowTagEditor);
  const setSelectedTagGroup = useTagStore((s) => s.setSelectedTagGroup);
  const setNewTagValue = useTagStore((s) => s.setNewTagValue);
  const handleAddTag = useTagStore((s) => s.handleAddTag);
  const handleRemoveTag = useTagStore((s) => s.handleRemoveTag);
  const handleAdoptSuggestion = useTagStore((s) => s.handleAdoptSuggestion);

  const meta = useCurrentFileMeta();

  const viewModel = useMemo(
    () =>
      buildTagInspectorViewModel({
        currentFilePath: currentFile?.path ?? "",
        currentContentId: meta?.contentId,
        contentIndex,
        syncStatus,
        tags: libTags,
        nameSuggestions,
      }),
    [currentFile?.path, meta?.contentId, contentIndex, syncStatus, libTags, nameSuggestions]
  );

  if (!currentFile) return null;

  return (
    <>
      <div className="border-t px-4 py-2 space-y-2">
        <div className="flex items-center gap-3">
          <FileAudio className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{currentFile.name}</span>
          <div className="flex gap-1 ml-auto flex-wrap">
            {viewModel.assignedTags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="group cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              >
                <span onClick={() => handleRemoveTag(tag)}>{tag.value}</span>
              </Badge>
            ))}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowTagEditor(!showTagEditor)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          {meta?.contentId && (
            <div>
              contentId：<span className="font-mono">{meta.contentId}</span>
            </div>
          )}
          <div>重复实例数：{viewModel.duplicateCount}</div>
          {viewModel.duplicateCount > 1 && (
            <div className="truncate">
              实例示例：{viewModel.instances.slice(0, 2).join(" / ")}
              {viewModel.instances.length > 2 ? " ..." : ""}
            </div>
          )}
          {viewModel.syncSummary && <div>{viewModel.syncSummary}</div>}
          {viewModel.showSuggestions && viewModel.suggestion && (
            <div className="space-y-2 pt-2">
              <div>
                名称建议：<span className="font-mono">{viewModel.suggestion.normalizedName}</span>
              </div>
              <div>建议来源：{viewModel.suggestion.sourceSummary}</div>
              <div>置信度：{Math.round(viewModel.suggestion.confidence * 100)}%</div>
              <div className="flex flex-wrap gap-1">
                {viewModel.suggestion.tags.map((tag, idx) => (
                  <Badge key={idx} variant="outline">
                    {tag.group}:{tag.value}
                  </Badge>
                ))}
              </div>
              <Button size="sm" variant="secondary" onClick={handleAdoptSuggestion}>
                采纳名称建议
              </Button>
            </div>
          )}
        </div>
      </div>

      {showTagEditor && (
        <div className="border-t px-4 py-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <select
              className="h-8 px-2 rounded border bg-background"
              value={selectedTagGroup}
              onChange={(e) => setSelectedTagGroup(e.target.value)}
            >
              {TAG_GROUPS.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="输入标签..."
              value={newTagValue}
              onChange={(e) => setNewTagValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              className="h-8 flex-1"
            />
            <Button size="sm" onClick={() => handleAddTag()}>
              添加
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowTagEditor(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {(() => {
            const group = TAG_GROUPS.find((g) => g.key === selectedTagGroup);
            return (
              group &&
              group.options.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {group.options.map((opt) => (
                    <Badge
                      key={opt}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleAddTag(selectedTagGroup, opt)}
                    >
                      {opt}
                    </Badge>
                  ))}
                </div>
              )
            );
          })()}
        </div>
      )}
    </>
  );
}
