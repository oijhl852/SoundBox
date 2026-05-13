import type { ContentIndexFile, FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

type BuildFilteredFilesInput = {
  visibleFiles: FileMeta[];
  contentIndex: ContentIndexFile | null;
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
  searchQuery: string;
  tagFilters: Set<string>;
};

type CollectVisibleTagsInput = {
  visibleFiles: FileMeta[];
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
};

function getSearchableTags(
  filePath: string,
  tags: Record<string, TagEntry[]>,
  nameSuggestions: Record<string, NameTagSuggestion>
) {
  const actualTags = tags[filePath] ?? [];
  const suggestedTags = nameSuggestions[filePath]?.tags ?? [];
  return actualTags.length > 0 ? actualTags : suggestedTags;
}

export function buildFilteredFiles({
  visibleFiles,
  contentIndex,
  tags,
  nameSuggestions,
  searchQuery,
  tagFilters,
}: BuildFilteredFilesInput): FileMeta[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return visibleFiles.filter((file) => {
    const duplicateCount = file.contentId ? contentIndex?.contents[file.contentId]?.instances.length ?? 0 : 0;
    const duplicateLabel = duplicateCount > 1 ? `重复 ${duplicateCount}` : "";
    const searchableTags = getSearchableTags(file.path, tags, nameSuggestions);

    const matchesSearch = normalizedQuery
      ? file.name.toLowerCase().includes(normalizedQuery) ||
        duplicateLabel.includes(searchQuery) ||
        searchableTags.some((tag) => tag.value.toLowerCase().includes(normalizedQuery))
      : true;

    const matchesTags = tagFilters.size > 0
      ? searchableTags.some((tag) => tagFilters.has(tag.value))
      : true;

    return matchesSearch && matchesTags;
  });
}

export function collectVisibleTags({
  visibleFiles,
  tags,
  nameSuggestions,
}: CollectVisibleTagsInput): string[] {
  const values = new Set<string>();

  for (const file of visibleFiles) {
    for (const tag of getSearchableTags(file.path, tags, nameSuggestions)) {
      values.add(tag.value);
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
