import { contextBridge, ipcRenderer } from "electron";
import type { AppSettings, DragDebugState } from "../src/lib/types.js";

/**
 * 拖出文件到外部应用（如 Premiere、桌面、文件夹）
 * 按照 Video Hub App 模式：只发送，不等待返回
 * @param filePath 要拖出的文件路径
 * @param iconPath 可选的图标路径（将作为拖拽时显示的图标）
 */
function dragOutFile(filePath: string, iconPath?: string): void {
  ipcRenderer.send("soundbox:drag-out-file", filePath, iconPath);
}



const soundbox = {
  platform: process.platform,
  selectFolder: () => ipcRenderer.invoke("soundbox:select-folder"),
  buildLibrarySnapshot: (path: string) => ipcRenderer.invoke("soundbox:build-library-snapshot", path),

  buildLibraryIndex: (path: string) => ipcRenderer.invoke("soundbox:build-library-index", path),
  getCachedSnapshot: (path: string) => ipcRenderer.invoke("soundbox:get-cached-snapshot", path),
  readFileIndex: () => ipcRenderer.invoke("soundbox:read-file-index"),
  readContentIndex: () => ipcRenderer.invoke("soundbox:read-content-index"),
  readLocalTags: () => ipcRenderer.invoke("soundbox:read-local-tags"),
  addTag: (contentId: string, group: string, value: string, author = "user") =>
    ipcRenderer.invoke("soundbox:add-tag", contentId, group, value, author),
  removeTag: (contentId: string, group: string, value: string) =>
    ipcRenderer.invoke("soundbox:remove-tag", contentId, group, value),
  loadSettings: () => ipcRenderer.invoke("soundbox:load-settings"),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke("soundbox:save-settings", settings),
  addLibrary: (name: string, path: string, libType: string) => ipcRenderer.invoke("soundbox:add-library", name, path, libType),
  removeLibrary: (path: string) => ipcRenderer.invoke("soundbox:remove-library", path),
  getAudioSource: (path: string) => ipcRenderer.invoke("soundbox:get-audio-source", path),
  getAudioMeta: (path: string) => ipcRenderer.invoke("soundbox:get-audio-meta", path),
  getWaveformPeaks: (path: string) => ipcRenderer.invoke("soundbox:get-waveform-peaks", path),
  getSyncStatus: () => ipcRenderer.invoke("soundbox:get-sync-status"),
  getDragDebugState: (): Promise<DragDebugState> => ipcRenderer.invoke("soundbox:get-drag-debug-state"),
  dragOutFile,
};


contextBridge.exposeInMainWorld("soundbox", soundbox);




