import { addTag, buildLibrarySnapshot, removeTag } from "@/lib/api";
import { buildSuggestionTags, resetTagEditorValue } from "@/lib/tag-domain-state";
import type { NameTagSuggestion } from "@/lib/types";

export async function refreshLibrarySnapshot(options: {
  activeLibrary: string;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
}) {
  const snapshot = await buildLibrarySnapshot(options.activeLibrary);
  options.cacheSnapshot(options.activeLibrary, snapshot);
  options.applySnapshot(snapshot);
}

export async function addResolvedTag(options: {
  contentId: string;
  group: string;
  value: string;
  activeLibrary: string;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
}) {
  await addTag(options.contentId, options.group, options.value, "user");
  await refreshLibrarySnapshot(options);
  return resetTagEditorValue();
}

export async function removeResolvedTag(options: {
  contentId: string;
  group: string;
  value: string;
  activeLibrary: string;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
}) {
  await removeTag(options.contentId, options.group, options.value);
  await refreshLibrarySnapshot(options);
}

export async function adoptSuggestionTags(options: {
  contentId: string;
  suggestion: NameTagSuggestion;
  activeLibrary: string;
  cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
  applySnapshot: (snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => void;
}) {
  for (const tag of buildSuggestionTags(options.suggestion)) {
    await addTag(options.contentId, tag.group, tag.value, "name-hint");
  }
  await refreshLibrarySnapshot(options);
}
