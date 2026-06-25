import { create } from "zustand";
import {
  adoptSuggestionTags,
  addResolvedTag,
  removeResolvedTag,
} from "@/lib/tag-domain-effects";
import {
  buildCurrentFileMeta,
  buildResolvedTagPayload,
  buildTagFilterToggle,
  resolveCurrentContentId,
  resolveSuggestionForFile,
} from "@/lib/tag-domain-state";
import type { TagEntry } from "@/lib/types";
import { useLibraryStore } from "./libraryStore";
import { usePlayerStore } from "./playerStore";

// ──────────────────────────────────────────────
// Store 类型
// ──────────────────────────────────────────────

interface TagState {
  tagFilters: Set<string>;
  showTagEditor: boolean;
  newTagValue: string;
  selectedTagGroup: string;
}

interface TagActions {
  handleAddTag: (groupOverride?: string, valueOverride?: string) => Promise<void>;
  handleRemoveTag: (tag: TagEntry) => Promise<void>;
  handleAdoptSuggestion: () => Promise<void>;
  toggleTagFilter: (tag: string) => void;
  setTagFilters: (value: Set<string>) => void;
  setShowTagEditor: (value: boolean) => void;
  setNewTagValue: (value: string) => void;
  setSelectedTagGroup: (value: string) => void;
}

type TagStore = TagState & TagActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useTagStore = create<TagStore>((set, get) => ({
  // State
  tagFilters: new Set(),
  showTagEditor: false,
  newTagValue: "",
  selectedTagGroup: "mood",

  // Actions
  handleAddTag: async (groupOverride?, valueOverride?) => {
    const currentFile = usePlayerStore.getState().currentFile;
    if (!currentFile) return;

    const allFiles = useLibraryStore.getState().allFiles;
    const contentId = resolveCurrentContentId(allFiles, currentFile.path);
    if (!contentId) return;

    const { selectedTagGroup, newTagValue } = get();
    const payload = buildResolvedTagPayload({
      groupOverride, valueOverride, selectedTagGroup, newTagValue,
    });
    if (!payload.value) return;

    const nextTagValue = await addResolvedTag({
      contentId, group: payload.group, value: payload.value,
    });
    set({ newTagValue: nextTagValue });
  },

  handleRemoveTag: async (tag) => {
    const currentFile = usePlayerStore.getState().currentFile;
    if (!currentFile || !tag.group) return;

    const allFiles = useLibraryStore.getState().allFiles;
    const contentId = resolveCurrentContentId(allFiles, currentFile.path);
    if (!contentId) return;

    await removeResolvedTag({ contentId, group: tag.group, value: tag.value });
  },

  handleAdoptSuggestion: async () => {
    const currentFile = usePlayerStore.getState().currentFile;
    if (!currentFile) return;

    const nameSuggestions = useLibraryStore.getState().nameSuggestions;
    const suggestion = resolveSuggestionForFile(nameSuggestions, currentFile.path);
    if (!suggestion) return;

    const allFiles = useLibraryStore.getState().allFiles;
    const contentId = resolveCurrentContentId(allFiles, currentFile.path) ?? "";

    await adoptSuggestionTags({ contentId, suggestion });
  },

  toggleTagFilter: (tag) => {
    set((prev) => ({
      tagFilters: buildTagFilterToggle(prev.tagFilters, tag),
    }));
  },

  setTagFilters: (value) => set({ tagFilters: value }),
  setShowTagEditor: (value) => set({ showTagEditor: value }),
  setNewTagValue: (value) => set({ newTagValue: value }),
  setSelectedTagGroup: (value) => set({ selectedTagGroup: value }),
}));

// ──────────────────────────────────────────────
// 便捷选择器（供组件使用）
// ──────────────────────────────────────────────

export function useCurrentFileMeta() {
  const currentFile = usePlayerStore((s) => s.currentFile);
  const allFiles = useLibraryStore((s) => s.allFiles);
  return buildCurrentFileMeta(allFiles, currentFile?.path ?? null);
}
