import { contextBridge, ipcRenderer } from "electron";
/**
 * 拖出文件到外部应用（如 Premiere、桌面、文件夹）
 * 按照 Video Hub App 模式：只发送，不等待返回
 * @param filePath 要拖出的文件路径
 * @param iconPath 可选的图标路径（将作为拖拽时显示的图标）
 */
function dragOutFile(filePath, iconPath) {
    ipcRenderer.send("soundbox:drag-out-file", filePath, iconPath);
}
const soundbox = {
    platform: process.platform,
    selectFolder: () => ipcRenderer.invoke("soundbox:select-folder"),
    buildLibrarySnapshot: (path) => ipcRenderer.invoke("soundbox:build-library-snapshot", path),
    buildLibraryIndex: (path) => ipcRenderer.invoke("soundbox:build-library-index", path),
    getCachedSnapshot: (path) => ipcRenderer.invoke("soundbox:get-cached-snapshot", path),
    readFileIndex: () => ipcRenderer.invoke("soundbox:read-file-index"),
    readContentIndex: () => ipcRenderer.invoke("soundbox:read-content-index"),
    readLocalTags: () => ipcRenderer.invoke("soundbox:read-local-tags"),
    addTag: (contentId, group, value, author = "user") => ipcRenderer.invoke("soundbox:add-tag", contentId, group, value, author),
    removeTag: (contentId, group, value) => ipcRenderer.invoke("soundbox:remove-tag", contentId, group, value),
    loadSettings: () => ipcRenderer.invoke("soundbox:load-settings"),
    saveSettings: (settings) => ipcRenderer.invoke("soundbox:save-settings", settings),
    addLibrary: (name, path, libType) => ipcRenderer.invoke("soundbox:add-library", name, path, libType),
    removeLibrary: (path) => ipcRenderer.invoke("soundbox:remove-library", path),
    getAudioSource: (path) => ipcRenderer.invoke("soundbox:get-audio-source", path),
    getWaveformPeaks: (path) => ipcRenderer.invoke("soundbox:get-waveform-peaks", path),
    getSyncStatus: () => ipcRenderer.invoke("soundbox:get-sync-status"),
    getDragDebugState: () => ipcRenderer.invoke("soundbox:get-drag-debug-state"),
    dragOutFile,
};
contextBridge.exposeInMainWorld("soundbox", soundbox);
//# sourceMappingURL=preload.js.map