import type { ContentIndexFile, NameTagSuggestion, SyncStatus, TagEntry } from "@/lib/types";

export type TagInspectorViewModel = {
  duplicateCount: number;
  instances: string[];
  assignedTags: TagEntry[];
  showSuggestions: boolean;
  suggestion: NameTagSuggestion | null;
  syncSummary: string | null;
};

export function buildTagInspectorViewModel(input: {
  currentFilePath: string | null;
  currentContentId?: string;
  contentIndex: ContentIndexFile | null;
  syncStatus: SyncStatus | null;
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
}): TagInspectorViewModel {
  const { currentFilePath, currentContentId, contentIndex, syncStatus, tags, nameSuggestions } = input;

  if (!currentFilePath) {
    return {
      duplicateCount: 0,
      instances: [],
      assignedTags: [],
      showSuggestions: false,
      suggestion: null,
      syncSummary: syncStatus ? `同步模式：${syncStatus.mode}｜待同步变更：${syncStatus.pendingChanges}` : null,
    };
  }

  const assignedTags = tags[currentFilePath] ?? [];
  const instances = currentContentId ? contentIndex?.contents[currentContentId]?.instances ?? [] : [];
  const duplicateCount = currentContentId ? contentIndex?.contents[currentContentId]?.instances.length ?? 0 : 0;
  const suggestion = assignedTags.length === 0 ? nameSuggestions[currentFilePath] ?? null : null;

  return {
    duplicateCount,
    instances,
    assignedTags,
    showSuggestions: Boolean(suggestion),
    suggestion,
    syncSummary: syncStatus ? `同步模式：${syncStatus.mode}｜待同步变更：${syncStatus.pendingChanges}` : null,
  };
}
