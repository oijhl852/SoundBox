import { collectFilesForFolder } from "@/lib/file-list-state";
import { buildFilteredFiles, collectVisibleTags } from "@/lib/file-filtering";
import { buildCurrentFileMeta } from "@/lib/tag-domain-state";
import type {
  ContentIndexFile,
  FileMeta,
  FolderNode,
  NameTagSuggestion,
  TagEntry,
} from "@/lib/types";


export function buildAppShellViewModel(options: {
  folderTree: FolderNode[];
  selectedFolderPath: string | null;
  contentIndex: ContentIndexFile | null;
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
  searchQuery: string;
  tagFilters: Set<string>;
  currentFilePath: string | null;
  allFiles: FileMeta[];
}) {
  const {
    folderTree,
    selectedFolderPath,
    contentIndex,
    tags,
    nameSuggestions,
    searchQuery,
    tagFilters,
    currentFilePath,
    allFiles,
  } = options;

  const visibleFiles = collectFilesForFolder(folderTree, selectedFolderPath);
  const filteredFiles = buildFilteredFiles({
    visibleFiles,
    contentIndex,
    tags,
    nameSuggestions,
    searchQuery,
    tagFilters,
  });
  const allUniqueTags = collectVisibleTags({
    visibleFiles,
    tags,
    nameSuggestions,
  });
  const currentTagInspectorMeta = buildCurrentFileMeta(allFiles, currentFilePath);

  return {
    visibleFiles,
    filteredFiles,
    allUniqueTags,
    currentTagInspectorMeta,
  };
}
