import type {
  AppSettings,
  AudioSourceResponse,
  ContentIndexFile,
  DragDebugState,
  FileIndexFile,
  LibrarySnapshot,
  LocalTagsFile,
  SyncStatus,
  WaveformResponse,
} from "@/lib/types";


export type SoundboxBridge = {
  platform: string;
  selectFolder: () => Promise<string | null>;
  buildLibrarySnapshot: (path: string) => Promise<LibrarySnapshot>;
  buildLibraryIndex: (path: string) => Promise<LibrarySnapshot>;
  getCachedSnapshot: (path: string) => Promise<LibrarySnapshot | null>;
  readFileIndex: () => Promise<FileIndexFile>;
  readContentIndex: () => Promise<ContentIndexFile>;
  readLocalTags: () => Promise<LocalTagsFile>;
  addTag: (contentId: string, group: string, value: string, author?: string) => Promise<void>;
  removeTag: (contentId: string, group: string, value: string) => Promise<void>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  addLibrary: (name: string, path: string, libType: string) => Promise<void>;
  removeLibrary: (path: string) => Promise<void>;
  getAudioSource: (path: string) => Promise<AudioSourceResponse>;
  getAudioMeta: (path: string) => Promise<{ duration: number }>;
  getWaveformPeaks: (path: string) => Promise<WaveformResponse>;
  getSyncStatus: () => Promise<SyncStatus>;
  getDragDebugState: () => Promise<DragDebugState>;
  batchPreloadWaveforms: (contentIds: string[]) => Promise<Record<string, number[]>>;
  dragOutFile: (path: string, iconPath?: string) => void;
};

export function requireBridgeMethod<K extends keyof SoundboxBridge>(
  bridge: Partial<SoundboxBridge>,
  methodName: K
): SoundboxBridge[K] {
  const method = bridge[methodName];
  if (!method) {
    throw new Error(`Electron 宿主尚未实现 ${String(methodName)}`);
  }
  return method as SoundboxBridge[K];
}
