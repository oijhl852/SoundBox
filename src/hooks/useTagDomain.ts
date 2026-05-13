import { useCallback, useMemo, useState } from "react";
import {
  adoptSuggestionTags,
  addResolvedTag,
  removeResolvedTag,
} from "@/lib/tag-domain-effects";
import {
  resolveCurrentFileMeta,
  resolveFileSuggestion,
  resolveTagContentId,
  resolveTagPayload,
  resolveTagRemovalContentId,
  toggleTagFilterState,
} from "@/lib/tag-domain-state";

import { buildLibrarySnapshot } from "@/lib/api";
import type {
  ContentIndexFile,
  FileMeta,
  MiniWaveformMap,
  NameTagSuggestion,
  TagEntry,
} from "@/lib/types";


export function useTagDomain(options: {
  activeLibrary: string;
  currentFile: { name: string; path: string } | null;
  allFiles: FileMeta[];
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
  contentIndex: ContentIndexFile | null;
  miniWaveforms: MiniWaveformMap;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
}) {
  const {
    activeLibrary,
    currentFile,
    allFiles,
    tags,
    nameSuggestions,
    contentIndex,
    miniWaveforms,
    applySnapshot,
    cacheSnapshot,
  } = options;

  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  const [selectedTagGroup, setSelectedTagGroup] = useState("mood");

  const currentMeta = useMemo(() => resolveCurrentFileMeta(allFiles, currentFile?.path ?? null), [allFiles, currentFile?.path]);


  const handleAddTag = useCallback(async (groupOverride?: string, valueOverride?: string) => {
    if (!currentFile) return;
    const contentId = resolveTagContentId(allFiles, currentFile.path);
    if (!contentId) return;

    const payload = resolveTagPayload({
      groupOverride,
      valueOverride,
      selectedTagGroup,
      newTagValue,
    });
    if (!payload.value) return;

    const nextTagValue = await addResolvedTag({
      contentId,
      group: payload.group,
      value: payload.value,
      activeLibrary,
      cacheSnapshot,
      applySnapshot,
    });
    setNewTagValue(nextTagValue);
  }, [activeLibrary, allFiles, applySnapshot, cacheSnapshot, currentFile, newTagValue, selectedTagGroup]);


  const handleRemoveTag = useCallback(async (tag: TagEntry) => {
    if (!currentFile || !tag.group) return;
    const contentId = resolveTagRemovalContentId(allFiles, currentFile.path);
    if (!contentId) return;

    await removeResolvedTag({
      contentId,
      group: tag.group,
      value: tag.value,
      activeLibrary,
      cacheSnapshot,
      applySnapshot,
    });
  }, [activeLibrary, allFiles, applySnapshot, cacheSnapshot, currentFile]);

  const handleAdoptSuggestion = useCallback(async () => {
    if (!currentFile) return;
    const suggestion = resolveFileSuggestion(nameSuggestions, currentFile.path);
    if (!suggestion) return;

    const contentId = resolveTagContentId(allFiles, currentFile.path) ?? "";
    await adoptSuggestionTags({
      contentId,
      suggestion,
      activeLibrary,
      cacheSnapshot,
      applySnapshot,
    });
  }, [activeLibrary, allFiles, applySnapshot, cacheSnapshot, currentFile, nameSuggestions]);


  const toggleTagFilter = useCallback((tag: string) => {
    setTagFilters((prev) => toggleTagFilterState(prev, tag));
  }, []);

  return {
    tagFilters,
    showTagEditor,
    newTagValue,
    selectedTagGroup,
    currentMeta,
    setTagFilters,

    setShowTagEditor,
    setNewTagValue,
    setSelectedTagGroup,
    toggleTagFilter,
    handleAddTag,
    handleRemoveTag,
    handleAdoptSuggestion,
  };
}
