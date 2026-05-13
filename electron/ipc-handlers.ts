import { app, type IpcMain } from "electron";
import path from "node:path";
import { computeContentId, getAudioSource } from "./audio.js";
import { getWaveformPeaks as getWaveformPeaksForFile } from "./ffmpeg.js";
import { selectFolder } from "./system.js";
import { createLibraryService } from "./library.js";
import { createTagService } from "./tags.js";
import { createDragDebugStore, registerDragOutHandler } from "./protocols.js";
import type { AppSettings } from "../src/lib/types.js";

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
  });
  const dragDebugStore = createDragDebugStore();

  ipcMain.handle("soundbox:select-folder", () => selectFolder());
  ipcMain.handle("soundbox:load-settings", () => libraryService.loadSettingsFile());
  ipcMain.handle("soundbox:save-settings", (_event, settings: AppSettings) => libraryService.saveSettingsFile(settings));
  ipcMain.handle("soundbox:add-library", (_event, name: string, libraryPath: string, libType: string) =>
    libraryService.addLibrary(name, libraryPath, libType)
  );
  ipcMain.handle("soundbox:remove-library", (_event, libraryPath: string) => libraryService.removeLibrary(libraryPath));
  ipcMain.handle("soundbox:get-audio-source", (_event, filePath: string) => getAudioSource(filePath));
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
  ipcMain.handle("soundbox:get-waveform-peaks", (_event, filePath: string) =>
    getWaveformPeaksForFile((name) => app.getPath(name), computeContentId, filePath)
  );
  ipcMain.handle("soundbox:get-drag-debug-state", () => dragDebugStore.getDragDebugState());
  registerDragOutHandler(ipcMain, dragDebugStore);
}
