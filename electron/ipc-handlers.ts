import { app, type IpcMain } from "electron";
import path from "node:path";
import { computeContentId, getAudioSource } from "./audio.js";
import { getWaveformPeaks as getWaveformPeaksForFile } from "./ffmpeg.js";
import { inspectAudioFile } from "./waveform-generator.js";
import { readWaveformCacheSafe } from "./waveform-cache.js";
import { selectFolder } from "./system.js";
import { createLibraryService } from "./library.js";
import { createTagService } from "./tags.js";
import { createDragDebugStore, registerDragOutHandler } from "./protocols.js";
import type { AppSettings, WaveformResponse } from "../src/lib/types.js";

function getAppDataDir() {
  return path.join(app.getPath("appData"), "Soundbox");
}

async function getSyncStatus() {
  return {
    mode: "local-only",
    localMetaPath: path.join(getAppDataDir(), "local-meta"),
    sharedMetaPath: null,
    lastSyncAt: null,
    pendingChanges: 0,
  };
}

export function registerSoundboxIpcHandlers(ipcMain: IpcMain) {
  const libraryService = createLibraryService(getAppDataDir);
  const tagService = createTagService({
    readLocalTagsFile: libraryService.readLocalTagsFile,
    writeLocalTagsFile: libraryService.writeLocalTagsFile,
    getTagsBaseDir: libraryService.getTagsBaseDir,
    readContentTags: libraryService.readContentTags,
    writeContentTags: libraryService.writeContentTags,
    deleteContentTags: libraryService.deleteContentTags,
    loadSettings: () => libraryService.loadSettingsFile(),
  });
  const dragDebugStore = createDragDebugStore();

  // 启动时自动迁移旧格式
  libraryService.loadSettingsFile().then((settings) =>
    libraryService.migrateToShardedTags(settings).catch(() => {})
  );

  ipcMain.handle("soundbox:select-folder", () => selectFolder());
  ipcMain.handle("soundbox:load-settings", () => libraryService.loadSettingsFile());
  ipcMain.handle("soundbox:save-settings", (_event, settings: AppSettings) => libraryService.saveSettingsFile(settings));
  ipcMain.handle("soundbox:add-library", (_event, name: string, libraryPath: string, libType: string) =>
    libraryService.addLibrary(name, libraryPath, libType)
  );
  ipcMain.handle("soundbox:remove-library", (_event, libraryPath: string) => libraryService.removeLibrary(libraryPath));
  ipcMain.handle("soundbox:get-audio-source", (_event, filePath: string) => getAudioSource(filePath));
  // 飞行中元数据请求去重
  const inflightAudioMeta = new Map<string, Promise<{ duration: number }>>();
  ipcMain.handle("soundbox:get-audio-meta", async (_event, filePath: string) => {
    const existing = inflightAudioMeta.get(filePath);
    if (existing) return existing;
    const job = inspectAudioFile(filePath).then(
      (probe) => ({ duration: probe.duration ?? 0 }),
      () => ({ duration: 0 })
    ).finally(() => inflightAudioMeta.delete(filePath));
    inflightAudioMeta.set(filePath, job);
    return job;
  });
  ipcMain.handle("soundbox:get-sync-status", () => getSyncStatus());
  ipcMain.handle("soundbox:read-file-index", () => libraryService.readFileIndexFile());
  ipcMain.handle("soundbox:read-content-index", () => libraryService.readContentIndexFile());
  ipcMain.handle("soundbox:read-local-tags", () => libraryService.readLocalTagsFile());
  ipcMain.handle("soundbox:build-library-snapshot", (_event, libraryPath: string) => libraryService.buildLibrarySnapshot(libraryPath));
  ipcMain.handle("soundbox:get-cached-snapshot", (_event, libraryPath: string) => libraryService.getCachedSnapshot(libraryPath));
  ipcMain.handle("soundbox:build-library-index", (_event, libraryPath: string) => libraryService.buildLibraryIndex(libraryPath));
  ipcMain.handle("soundbox:add-tag", (_event, contentId: string, group: string, value: string, author: string) =>
    tagService.addTag(contentId, group, value, author)
  );
  ipcMain.handle("soundbox:remove-tag", (_event, contentId: string, group: string, value: string) =>
    tagService.removeTag(contentId, group, value)
  );
  // 飞行中波形请求去重（按文件路径，避免 computeContentId 前重复）
  const inflightWaveformByPath = new Map<string, Promise<WaveformResponse>>();
  ipcMain.handle("soundbox:get-waveform-peaks", (_event, filePath: string) => {
    const existing = inflightWaveformByPath.get(filePath);
    if (existing) return existing;
    const job = getWaveformPeaksForFile(
      (name) => app.getPath(name), computeContentId, filePath
    ).finally(() => inflightWaveformByPath.delete(filePath));
    inflightWaveformByPath.set(filePath, job);
    return job;
  });
  ipcMain.handle("soundbox:get-drag-debug-state", () => dragDebugStore.getDragDebugState());
  // 批量预载磁盘波形缓存（启动时一次性填充，并行读取最多 50 个文件）
  ipcMain.handle("soundbox:batch-preload-waveforms", async (_event, contentIds: string[]) => {
    const results: Record<string, number[]> = {};
    const BATCH = 50;
    for (let i = 0; i < contentIds.length; i += BATCH) {
      const slice = contentIds.slice(i, i + BATCH);
      const entries = await Promise.all(
        slice.map(async (contentId) => {
          const cached = await readWaveformCacheSafe((name) => app.getPath(name), contentId);
          return cached?.peaks?.length ? [contentId, cached.peaks] as const : null;
        })
      );
      for (const entry of entries) {
        if (entry) results[entry[0]] = entry[1];
      }
    }
    return results;
  });
  registerDragOutHandler(ipcMain, dragDebugStore);
}
