import path from "node:path";
import { createHash } from "node:crypto";
import type {
  FileIndexEntry,
  FileIndexFile,
  LocalTagsFile,
  NameTagSuggestion,
} from "../src/lib/types.js";
import type { createLibraryStorage } from "./library-storage.js";

export const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".ogg", ".flac", ".aac"]);

type LibraryStorage = ReturnType<typeof createLibraryStorage>;

export function isAudioFile(filePath: string) {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function createLibraryId(libraryPath: string) {
  return `lib-${createHash("sha256").update(libraryPath).digest("hex").slice(0, 12)}`;
}

export function normalizeAudioName(name: string, removableTokens: string[]) {
  return path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replaceAll("（", "(")
    .replaceAll("）", ")")
    .replaceAll("[", " ")
    .replaceAll("]", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !removableTokens.includes(part))
    .join(" ");
}

export function buildTagHintsForName(contentIds: string[], localTags: LocalTagsFile) {
  const grouped: Record<string, string[]> = {};
  for (const contentId of contentIds) {
    const record = localTags.contents[contentId];
    if (!record) continue;
    for (const [group, entries] of Object.entries(record.tags)) {
      grouped[group] ??= [];
      for (const entry of entries) {
        if (!grouped[group].includes(entry.value)) {
          grouped[group].push(entry.value);
        }
      }
    }
  }
  return grouped;
}

export function buildNameSuggestions(
  fileIndex: FileIndexFile,
  nameIndex: ReturnType<LibraryStorage["readNameIndexFile"]> extends Promise<infer T> ? T : never,
  localTags: LocalTagsFile,
  removableTokens: string[]
) {
  const suggestions: Record<string, NameTagSuggestion> = {};

  for (const file of fileIndex.files) {
    const hasContentTags = Boolean(localTags.contents[file.contentId]?.tags && Object.keys(localTags.contents[file.contentId].tags).length > 0);
    if (hasContentTags) continue;

    const normalizedName = normalizeAudioName(file.relativePath, removableTokens);
    const nameRecord = nameIndex.names[normalizedName];
    if (!nameRecord) continue;

    const tags = Object.entries(nameRecord.tagHints).flatMap(([group, values]) =>
      values.map((value) => ({ group, value }))
    );

    if (tags.length === 0) continue;
    const sourceCount = nameRecord.contentIds.length;
    suggestions[file.absolutePath] = {
      normalizedName,
      tags,
      sourceContentIds: nameRecord.contentIds,
      confidence: sourceCount >= 3 ? 0.95 : sourceCount === 2 ? 0.8 : 0.6,
      sourceSummary: `来自 ${sourceCount} 个同名内容的历史标签`,
    };
  }

  return suggestions;
}

export async function rebuildNameIndex(
  storage: LibraryStorage,
  fileEntries: FileIndexEntry[],
  localTags: LocalTagsFile,
  libraryId: string
) {
  const nameIndex = await storage.readNameIndexFile();
  const normalizationConfig = await storage.readNameNormalizationConfig();
  const currentFileIndex = await storage.readFileIndexFile();
  const retainedLibraryFiles = currentFileIndex.files.filter((entry) => entry.libraryId !== libraryId);
  const nextFilesByContentId = new Map(fileEntries.map((file) => [file.contentId, file]));

  for (const [normalizedName, record] of Object.entries(nameIndex.names)) {
    const retainedContentIds = record.contentIds.filter((contentId) => {
      if (nextFilesByContentId.has(contentId)) {
        return true;
      }
      return retainedLibraryFiles.some((entry) => {
        return entry.contentId === contentId && normalizeAudioName(entry.relativePath, normalizationConfig.removableTokens) === normalizedName;
      });
    });

    if (retainedContentIds.length === 0) {
      delete nameIndex.names[normalizedName];
      continue;
    }

    nameIndex.names[normalizedName] = {
      ...record,
      contentIds: retainedContentIds,
      tagHints: buildTagHintsForName(retainedContentIds, localTags),
      updatedAt: new Date().toISOString(),
    };
  }

  for (const file of fileEntries) {
    const normalizedName = normalizeAudioName(file.relativePath, normalizationConfig.removableTokens);
    const record = nameIndex.names[normalizedName] ?? {
      contentIds: [],
      tagHints: {},
      updatedAt: new Date().toISOString(),
    };

    if (!record.contentIds.includes(file.contentId)) {
      record.contentIds.push(file.contentId);
    }

    record.tagHints = buildTagHintsForName(record.contentIds, localTags);
    record.updatedAt = new Date().toISOString();
    nameIndex.names[normalizedName] = record;
  }

  await storage.writeNameIndexFile(nameIndex);
  return { nameIndex, normalizationConfig };
}
