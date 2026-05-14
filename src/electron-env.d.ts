import type {
  AppSettings,
  AudioMetaResponse,
  AudioSourceResponse,
  ContentIndexFile,
  FileIndexFile,
  FolderNode,
  LibrarySnapshot,
  LocalTagsFile,
  SyncStatus,
  WaveformResponse,
} from "@/lib/types";

export {};

declare global {
  interface Window {
    soundbox?: {
      platform: NodeJS.Platform;
      selectFolder?: () => Promise<string | null>;
      buildLibrarySnapshot?: (path: string) => Promise<LibrarySnapshot>;

      buildLibraryIndex?: (path: string) => Promise<LibrarySnapshot>;
      readFileIndex?: () => Promise<FileIndexFile>;
      readContentIndex?: () => Promise<ContentIndexFile>;
      readLocalTags?: () => Promise<LocalTagsFile>;
      addTag?: (contentId: string, group: string, value: string, author?: string) => Promise<void>;
      removeTag?: (contentId: string, group: string, value: string) => Promise<void>;
      loadSettings?: () => Promise<AppSettings>;
      saveSettings?: (settings: AppSettings) => Promise<void>;
      addLibrary?: (name: string, path: string, libType: string) => Promise<void>;
      removeLibrary?: (path: string) => Promise<void>;
      getAudioSource?: (path: string) => Promise<AudioSourceResponse>;
      getAudioMeta?: (path: string) => Promise<AudioMetaResponse>;
      getWaveformPeaks?: (path: string) => Promise<WaveformResponse>;
      getSyncStatus?: () => Promise<SyncStatus>;
      getDragDebugState?: () => Promise<DragDebugState>;
      dragOutFile?: (path: string, iconPath?: string) => void;


    };



  }
}
