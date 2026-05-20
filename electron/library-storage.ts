import path from "node:path";
import fs from "node:fs/promises";
import type {
  AppSettings,
  ContentIndexFile,
  FileIndexFile,
  LocalTagsFile,
  TagEntry,
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
  version: "3.0",
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

  // ── 分片标签存储（v3.0+）──

  function getTagsBaseDir(settings: AppSettings) {
    return settings.custom_tag_path
      ? path.join(settings.custom_tag_path, "tags")
      : path.join(getAppDataDir(), "tags");
  }

  function getContentTagPath(tagsBaseDir: string, contentId: string) {
    const sanitized = contentId.replaceAll(":", "_");
    const bucket = sanitized.slice(0, 9);
    return path.join(tagsBaseDir, "content", bucket, `${sanitized}.json`);
  }

  function contentTagFromFile(raw: Record<string, unknown>): Record<string, TagEntry[]> {
    const result: Record<string, TagEntry[]> = {};
    for (const [group, entries] of Object.entries(raw)) {
      if (!Array.isArray(entries)) continue;
      result[group] = entries.filter(
        (e): e is TagEntry => typeof (e as TagEntry)?.value === "string"
      );
    }
    return result;
  }

  async function readContentTags(tagsBaseDir: string, contentId: string): Promise<Record<string, TagEntry[]>> {
    const filePath = getContentTagPath(tagsBaseDir, contentId);
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw.trim());
      return contentTagFromFile(parsed);
    } catch {
      return {};
    }
  }

  async function writeContentTags(tagsBaseDir: string, contentId: string, tags: Record<string, TagEntry[]>) {
    const filePath = getContentTagPath(tagsBaseDir, contentId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(tags, null, 2), "utf-8");
    await fs.rename(tempPath, filePath);
  }

  async function deleteContentTags(tagsBaseDir: string, contentId: string) {
    const filePath = getContentTagPath(tagsBaseDir, contentId);
    await fs.rm(filePath, { force: true }).catch(() => {});
    await fs.rm(`${filePath}.tmp`, { force: true }).catch(() => {});
  }

  // 扫描所有分片文件，构建完整 LocalTagsFile
  async function readAllContentTags(settings: AppSettings): Promise<LocalTagsFile> {
    // 先尝试旧格式（未迁移或迁移中断）
    try {
      const oldTags = await readLocalTagsFile();
      if (Object.keys(oldTags.contents).length > 0) {
        return oldTags;
      }
    } catch { /* 旧文件不存在，正常 */ }

    const tagsBaseDir = getTagsBaseDir(settings);
    const contentDir = path.join(tagsBaseDir, "content");
    const result: LocalTagsFile = { version: "3.0", contents: {} };

    try {
      const buckets = await fs.readdir(contentDir, { withFileTypes: true });
      for (const bucket of buckets) {
        if (!bucket.isDirectory()) continue;
        const bucketPath = path.join(contentDir, bucket.name);
        const files = await fs.readdir(bucketPath);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const raw = await fs.readFile(path.join(bucketPath, file), "utf-8");
            const tags = contentTagFromFile(JSON.parse(raw.trim()));
            if (Object.keys(tags).length === 0) continue;
            // 从文件名还原 contentId：sha256_ABC123...json → sha256:ABC123...
            const contentId = file.replace(".json", "").replace("_", ":");
            result.contents[contentId] = { tags };
          } catch { /* skip corrupt files */ }
        }
      }
    } catch { /* content dir not yet created */ }

    return result;
  }

  // 旧格式迁移：local-tags.json → 分片
  async function migrateToShardedTags(settings: AppSettings) {
    const oldPath = getLocalTagsPath();
    try {
      await fs.access(oldPath);
    } catch {
      return; // 旧文件不存在，无需迁移
    }

    const oldTags = await readLocalTagsFile();
    if (oldTags.version === "3.0") return; // 已迁移

    const tagsBaseDir = getTagsBaseDir(settings);
    for (const [contentId, record] of Object.entries(oldTags.contents)) {
      if (record.tags && Object.keys(record.tags).length > 0) {
        await writeContentTags(tagsBaseDir, contentId, record.tags);
      }
    }

    // 迁移完成，删除旧文件
    await fs.rm(oldPath, { force: true }).catch(() => {});
    console.log("[tags] migrated to sharded v3.0, entries:", Object.keys(oldTags.contents).length);
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
    // 分片存储
    getTagsBaseDir,
    readContentTags,
    writeContentTags,
    deleteContentTags,
    readAllContentTags,
    migrateToShardedTags,
  };
}
