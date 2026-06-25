import type {
  AppSettings,
  AudioSourceResponse,
  AudioMetaResponse,
  ContentIndexFile,
  DragDebugState,
  FileIndexFile,
  LibrarySnapshot,
  LocalTagsFile,
  SyncStatus,
  WaveformResponse,
} from "./types";
import { requireBridgeMethod, type SoundboxBridge } from "./bridge-contract";
import { logError } from "./logger";



const getElectronApi = (): Partial<SoundboxBridge> => {
  if (typeof window === "undefined" || !window.soundbox) {
    throw new Error("当前未检测到 Electron 宿主接口");
  }
  return window.soundbox;
};


async function callElectron<T>(
  actionName: string,
  invoke: (api: Partial<SoundboxBridge>) => Promise<T>
): Promise<T> {

  const api = getElectronApi();
  try {
    return await invoke(api);
  } catch (error) {
    throw new Error(`${actionName} 调用失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function selectFolder(): Promise<string | null> {
  return callElectron("selectFolder", (api) => {
    return requireBridgeMethod(api, "selectFolder")();
  });
}




export async function buildLibrarySnapshot(path: string): Promise<LibrarySnapshot> {
  return callElectron("buildLibrarySnapshot", (api) => {
    return requireBridgeMethod(api, "buildLibrarySnapshot")(path);
  });
}


export async function buildLibraryIndex(path: string): Promise<LibrarySnapshot> {
  return callElectron("buildLibraryIndex", (api) => {
    if (!api.buildLibraryIndex) throw new Error("Electron 宿主尚未实现 buildLibraryIndex");
    return api.buildLibraryIndex(path);
  });
}

export async function getCachedSnapshot(path: string): Promise<LibrarySnapshot | null> {
  return callElectron("getCachedSnapshot", (api) => {
    return requireBridgeMethod(api, "getCachedSnapshot")(path);
  });
}

export async function readFileIndex(): Promise<FileIndexFile> {
  return callElectron("readFileIndex", (api) => {
    if (!api.readFileIndex) throw new Error("Electron 宿主尚未实现 readFileIndex");
    return api.readFileIndex();
  });
}

export async function readContentIndex(): Promise<ContentIndexFile> {
  return callElectron("readContentIndex", (api) => {
    return requireBridgeMethod(api, "readContentIndex")();
  });
}


export async function readLocalTags(): Promise<LocalTagsFile> {
  return callElectron("readLocalTags", (api) => {
    return requireBridgeMethod(api, "readLocalTags")();

  });
}

export async function addTag(contentId: string, group: string, value: string, author = "user"): Promise<void> {
  return callElectron("addTag", (api) => {
    return requireBridgeMethod(api, "addTag")(contentId, group, value, author);

  });
}

export async function removeTag(contentId: string, group: string, value: string): Promise<void> {
  return callElectron("removeTag", (api) => {
    return requireBridgeMethod(api, "removeTag")(contentId, group, value);

  });
}

export async function loadSettings(): Promise<AppSettings> {
  return callElectron("loadSettings", (api) => {
    return requireBridgeMethod(api, "loadSettings")();
  });
}


export async function saveSettings(settings: AppSettings): Promise<void> {
  return callElectron("saveSettings", (api) => {
    if (!api.saveSettings) throw new Error("Electron 宿主尚未实现 saveSettings");
    return api.saveSettings(settings);
  });
}

export async function addLibrary(name: string, path: string, libType: string): Promise<void> {
  return callElectron("addLibrary", (api) => {
    if (!api.addLibrary) throw new Error("Electron 宿主尚未实现 addLibrary");
    return api.addLibrary(name, path, libType);
  });
}

export async function removeLibrary(path: string): Promise<void> {
  return callElectron("removeLibrary", (api) => {
    if (!api.removeLibrary) throw new Error("Electron 宿主尚未实现 removeLibrary");
    return api.removeLibrary(path);
  });
}

export async function getAudioSource(path: string): Promise<AudioSourceResponse> {
  return callElectron("getAudioSource", (api) => {
    return requireBridgeMethod(api, "getAudioSource")(path);
  });
}

export async function getAudioMeta(path: string): Promise<AudioMetaResponse> {
  return callElectron("getAudioMeta", (api) => {
    return requireBridgeMethod(api, "getAudioMeta")(path);
  });
}


export async function getWaveformPeaks(path: string): Promise<WaveformResponse> {
  return callElectron("getWaveformPeaks", (api) => {
    return requireBridgeMethod(api, "getWaveformPeaks")(path);

  });
}

export async function getSyncStatus(): Promise<SyncStatus> {
  return callElectron("getSyncStatus", (api) => {
    return requireBridgeMethod(api, "getSyncStatus")();

  });
}

export async function getDragDebugState(): Promise<DragDebugState> {
  return callElectron("getDragDebugState", (api) => {
    return requireBridgeMethod(api, "getDragDebugState")();
  });
}


/**
 * 拖出文件到外部应用
 * 按照 Video Hub App 模式：只发送，不等待返回
 * @param path 要拖出的文件路径
 */
export function dragOutFile(path: string, iconPath?: string): void {
  if (!window.soundbox?.dragOutFile) {
    logError("[bridge][renderer] dragOutFile not implemented", { path, iconPath });
    return;
  }
  window.soundbox.dragOutFile(path, iconPath);

}

/** 批量预载磁盘波形缓存，返回 contentId → peaks 映射 */
export async function batchPreloadWaveforms(contentIds: string[]): Promise<Record<string, number[]>> {
  return callElectron("batchPreloadWaveforms", (api) => {
    return requireBridgeMethod(api, "batchPreloadWaveforms")(contentIds);
  });
}







