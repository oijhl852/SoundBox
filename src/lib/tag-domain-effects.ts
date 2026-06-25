import { addTag, removeTag } from "@/lib/api";
import { buildSuggestionAdoptionPlan } from "@/lib/tag-domain-state";
import type { NameTagSuggestion, TagEntry } from "@/lib/types";


/** 增量更新 store 中的 tags——不重建快照，直接改内存 */
async function updateTagsInPlace(
  contentId: string,
  buildTags: (prevByGroup: Record<string, TagEntry[]>) => Record<string, TagEntry[]>
) {
  const { useLibraryStore } = await import("@/stores/libraryStore");
  const state = useLibraryStore.getState();
  const allFiles = state.allFiles;
  const filePaths = allFiles.filter((f) => f.contentId === contentId).map((f) => f.path);
  if (filePaths.length === 0) return;

  // 从现有一条 filePath 的 tags 反推当前 contentId 的 tags
  const existing = state.tags[filePaths[0]] ?? [];
  const prevByGroup: Record<string, TagEntry[]> = {};
  for (const t of existing) {
    if (t.group) (prevByGroup[t.group] ??= []).push(t);
  }

  const nextByGroup = buildTags(prevByGroup);
  const flat: TagEntry[] = Object.values(nextByGroup).flat();

  const nextTags = { ...state.tags };
  for (const fp of filePaths) {
    nextTags[fp] = flat;
  }

  useLibraryStore.setState({ tags: nextTags });
}

export async function addResolvedTag(options: {
  contentId: string;
  group: string;
  value: string;
}) {
  await addTag(options.contentId, options.group, options.value, "user");

  await updateTagsInPlace(options.contentId, (prev) => {
    const nextTag: TagEntry = {
      group: options.group,
      value: options.value,
      author: "user",
      createdAt: new Date().toISOString(),
    };
    const groupTags = [...(prev[options.group] ?? [])];
    // 去重：同 group 下已有相同 value 则跳过
    if (!groupTags.some((t) => t.value === options.value)) {
      groupTags.push(nextTag);
    }
    return { ...prev, [options.group]: groupTags };
  });

  return "";
}

export async function removeResolvedTag(options: {
  contentId: string;
  group: string;
  value: string;
}) {
  await removeTag(options.contentId, options.group, options.value);

  await updateTagsInPlace(options.contentId, (prev) => {
    const groupTags = (prev[options.group] ?? []).filter(
      (t) => t.value !== options.value
    );
    const next = { ...prev };
    if (groupTags.length > 0) {
      next[options.group] = groupTags;
    } else {
      delete next[options.group];
    }
    return next;
  });
}

export async function adoptSuggestionTags(options: {
  contentId: string;
  suggestion: NameTagSuggestion;
}) {
  for (const tag of buildSuggestionAdoptionPlan(options.suggestion)) {
    await addTag(options.contentId, tag.group, tag.value, "name-hint");
  }

  await updateTagsInPlace(options.contentId, (prev) => {
    const next = { ...prev };
    for (const tag of buildSuggestionAdoptionPlan(options.suggestion)) {
      const groupTags = [...(next[tag.group] ?? [])];
      if (!groupTags.some((t) => t.value === tag.value)) {
        groupTags.push({
          group: tag.group,
          value: tag.value,
          author: "name-hint",
          createdAt: new Date().toISOString(),
        });
      }
      next[tag.group] = groupTags;
    }
    return next;
  });
}
