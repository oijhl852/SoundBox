import type { FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

export function resolveContentIdForFile(
  files: FileMeta[],
  filePath: string | null
): string | null {
  if (!filePath) {
    return null;
  }

  return files.find((file) => file.path === filePath)?.contentId ?? null;
}

export function shouldShowNameSuggestions(
  tagsByPath: Record<string, TagEntry[]>,
  suggestions: Record<string, NameTagSuggestion>,
  filePath: string | null
): boolean {
  if (!filePath) {
    return false;
  }

  return !(tagsByPath[filePath]?.length) && Boolean(suggestions[filePath]);
}
