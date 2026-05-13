import { resolveContentIdForFile } from "@/lib/tag-actions";
import type { FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

export function buildResolvedTagPayload(
  groupOverride: string | undefined,
  valueOverride: string | undefined,
  selectedTagGroup: string,
  newTagValue: string
) {
  return {
    group: groupOverride ?? selectedTagGroup,
    value: (valueOverride ?? newTagValue).trim(),
  };
}

export function buildSuggestionAdoptionPlan(suggestion: { tags: { group: string; value: string }[] }) {
  return [...suggestion.tags];
}

export function resolveCurrentContentId(files: FileMeta[], filePath: string | null) {
  return resolveContentIdForFile(files, filePath);
}

export function resolveTagRemovalContentId(files: FileMeta[], filePath: string | null) {
  return resolveContentIdForFile(files, filePath);
}

export function resolveSuggestionForFile(
  suggestions: Record<string, NameTagSuggestion>,
  filePath: string | null
) {
  if (!filePath) {
    return null;
  }
  return suggestions[filePath] ?? null;
}

export function applyTagEditorReset() {
  return {
    newTagValue: "",
  };
}

export function buildCurrentFileMeta(files: FileMeta[], filePath: string | null) {
  if (!filePath) {
    return undefined;
  }
  return files.find((file) => file.path === filePath);
}

export function buildTagFilterToggle(current: Set<string>, tag: string) {
  const next = new Set(current);
  next.has(tag) ? next.delete(tag) : next.add(tag);
  return next;
}

export function resolveTagPayload(options: {
  groupOverride?: string;
  valueOverride?: string;
  selectedTagGroup: string;
  newTagValue: string;
}) {
  return buildResolvedTagPayload(
    options.groupOverride,
    options.valueOverride,
    options.selectedTagGroup,
    options.newTagValue
  );
}

export function resolveTagContentId(files: FileMeta[], filePath: string | null) {
  return resolveCurrentContentId(files, filePath);
}

export function resolveTagRemovalId(files: FileMeta[], filePath: string | null) {
  return resolveTagRemovalContentId(files, filePath);
}

export function resolveFileSuggestion(
  suggestions: Record<string, NameTagSuggestion>,
  filePath: string | null
) {
  return resolveSuggestionForFile(suggestions, filePath);
}

export function buildSuggestionTags(suggestion: { tags: { group: string; value: string }[] }) {
  return buildSuggestionAdoptionPlan(suggestion);
}

export function resetTagEditorValue() {
  return applyTagEditorReset().newTagValue;
}

export function toggleTagFilterState(current: Set<string>, tag: string) {
  return buildTagFilterToggle(current, tag);
}

export function resolveCurrentFileMeta(files: FileMeta[], filePath: string | null) {
  return buildCurrentFileMeta(files, filePath);
}

export function canRemoveTag(tag: TagEntry) {
  return Boolean(tag.group);
}
