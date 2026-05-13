import path from "node:path";
import fs from "node:fs/promises";
import type {
  AppSettings,
  ContentIndexFile,
  FileIndexFile,
  LocalTagsFile,
} from "../src/lib/types.js";
import { log } from "../src/lib/logger.js";

export const DEFAULT_SETTINGS: AppSettings = {
  libraries: [],
  waveform_cache_path: null,
  tag_storage_mode: "local",
  custom_tag_path: null,
};

export const DEFAULT_FILE_INDEX: FileIndexFile = {
  version: "2.0",
  libraries: {},
  files: [],
};

export const DEFAULT_CONTENT_INDEX: ContentIndexFile = {
  version: "2.0",
  contents: {},
};

export const DEFAULT_LOCAL_TAGS: LocalTagsFile = {
  version: "2.0",
  contents: {},
};

export const DEFAULT_NAME_INDEX = {
  version: "1.0",
  names: {} as Record<string, { contentIds: string[]; tagHints: Record<string, string[]>; updatedAt: string }>,
};

export const DEFAULT_NAME_NORMALIZATION = {
  removableTokens: ["用烂了", "副本", "copy", "已剪"],
};

export function createLibraryStorage(getAppDataDir: () => string) {
  function getLocalMetaDir() {
    return path.join(getAppDataDir(), "local-meta");
  }

  function getSettingsPath() {
    return path.join(getAppDataDir(), "settings.json");
  }

  function getFileIndexPath() {
    return path.join(getLocalMetaDir(), "file-index.json");
  }

  function getContentIndexPath() {
    return path.join(getLocalMetaDir(), "content-index.json");
  }

  function getLocalTagsPath() {
    return path.join(getLocalMetaDir(), "local-tags.json");
  }

  function getNameIndexPath() {
    return path.join(getLocalMetaDir(), "name-index.json");
  }

  function getNameNormalizationPath() {
    return path.join(getLocalMetaDir(), "name-normalization.json");
  }

  async function ensureAppDataDir() {
    await fs.mkdir(getAppDataDir(), { recursive: true });
  }

  async function ensureLocalMetaDir() {
    await fs.mkdir(getLocalMetaDir(), { recursive: true });
  }

  async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const trimmed = raw.trim();
      if (!trimmed) {
        log("warn", "[json] empty-file-fallback", { filePath });
        return fallback;
      }

      const parsed = JSON.parse(trimmed) as T;
      if (parsed && typeof parsed === "object" && fallback && typeof fallback === "object") {
        return { ...fallback, ...parsed } as T;
      }
      return parsed;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === "ENOENT") {
        return fallback;
      }

      if (error instanceof SyntaxError) {
        log("warn", "[json] parse-failed-fallback", {
          filePath,
          error: error.message,
        });
        return fallback;
      }

      throw error;
    }
  }

  async function loadSettingsFile(): Promise<AppSettings> {
    return readJsonFile(getSettingsPath(), DEFAULT_SETTINGS);
  }

  async function saveSettingsFile(settings: AppSettings) {
    await ensureAppDataDir();
    await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), "utf-8");
  }

  async function readFileIndexFile(): Promise<FileIndexFile> {
    return readJsonFile(getFileIndexPath(), DEFAULT_FILE_INDEX);
  }

  async function writeFileIndexFile(fileIndex: FileIndexFile) {
    await ensureLocalMetaDir();
    await fs.writeFile(getFileIndexPath(), JSON.stringify(fileIndex, null, 2), "utf-8");
  }

  async function readContentIndexFile(): Promise<ContentIndexFile> {
    return readJsonFile(getContentIndexPath(), DEFAULT_CONTENT_INDEX);
  }

  async function writeContentIndexFile(contentIndex: ContentIndexFile) {
    await ensureLocalMetaDir();
    await fs.writeFile(getContentIndexPath(), JSON.stringify(contentIndex, null, 2), "utf-8");
  }

  async function readLocalTagsFile(): Promise<LocalTagsFile> {
    return readJsonFile(getLocalTagsPath(), DEFAULT_LOCAL_TAGS);
  }

  async function writeLocalTagsFile(localTags: LocalTagsFile) {
    await ensureLocalMetaDir();
    await fs.writeFile(getLocalTagsPath(), JSON.stringify(localTags, null, 2), "utf-8");
  }

  async function readNameIndexFile() {
    return readJsonFile(getNameIndexPath(), DEFAULT_NAME_INDEX);
  }

  async function writeNameIndexFile(nameIndex: typeof DEFAULT_NAME_INDEX) {
    await ensureLocalMetaDir();
    await fs.writeFile(getNameIndexPath(), JSON.stringify(nameIndex, null, 2), "utf-8");
  }

  async function readNameNormalizationConfig() {
    const config = await readJsonFile(getNameNormalizationPath(), DEFAULT_NAME_NORMALIZATION);
    await ensureLocalMetaDir();
    await fs.writeFile(getNameNormalizationPath(), JSON.stringify(config, null, 2), "utf-8");
    return config;
  }

  return {
    getLocalMetaDir,
    ensureAppDataDir,
    ensureLocalMetaDir,
    loadSettingsFile,
    saveSettingsFile,
    readFileIndexFile,
    writeFileIndexFile,
    readContentIndexFile,
    writeContentIndexFile,
    readLocalTagsFile,
    writeLocalTagsFile,
    readNameIndexFile,
    writeNameIndexFile,
    readNameNormalizationConfig,
  };
}
