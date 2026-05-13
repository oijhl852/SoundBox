export interface AudioFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  contentId?: string;
  relativePath?: string;
}

export interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  files: AudioFile[];
}

export interface TagEntry {
  group?: string;
  value: string;
  author: string;
  createdAt: string;
  verified?: boolean;
}

export interface SuggestedTagEntry {
  group: string;
  value: string;
}

export interface NameTagSuggestion {
  normalizedName: string;
  tags: SuggestedTagEntry[];
  sourceContentIds: string[];
  confidence: number;
  sourceSummary: string;
}



export interface AudioMetadata {
  tags: Record<string, TagEntry[]>;
  duration?: number;
  waveformCache?: string;
}

export interface AudioSourceResponse {
  path: string;
  mime: string;
}

export interface WaveformResponse {
  duration: number;
  peaks: number[];
}

export interface MiniWaveformMap {
  [path: string]: number[];
}



export interface LocalTagsFile {
  version: string;
  users?: Record<string, { name: string; role: string }>;
  contents: Record<string, { tags: Record<string, TagEntry[]> }>;
  settings?: {
    collaborativeMode?: boolean;
    conflictResolution?: string;
    repositoryMode?: string;
  };
}

export interface SyncStatus {
  mode: string;
  localMetaPath: string;
  sharedMetaPath?: string | null;
  lastSyncAt?: string | null;
  pendingChanges: number;
}

export interface LibraryLoadState {
  status: "idle" | "indexing" | "ready" | "error";
  message?: string;
  usedCache?: boolean;
  indexingComplete?: boolean;
}

export interface LibraryConfig {
  name: string;
  path: string;
  lib_type: string;
}

export interface AppSettings {
  libraries: LibraryConfig[];
  waveform_cache_path: string | null;
  tag_storage_mode: string;
  custom_tag_path: string | null;
}

export interface FileIndexEntry {
  fileId: string;
  libraryId: string;
  libraryName?: string;
  relativePath: string;
  absolutePath: string;
  size: number;
  modifiedAt: number;
  extension: string;
  contentId: string;
}

export interface FileIndexFile {
  version: string;
  libraries: Record<string, { name: string; path: string }>;
  files: FileIndexEntry[];
}

export interface ContentIndexEntry {
  canonicalName: string;
  instances: string[];
  waveformCache?: string;
}

export interface ContentIndexFile {
  version: string;
  contents: Record<string, ContentIndexEntry>;
}

export interface DragDebugState {
  stage: "idle" | "renderer-dispatched" | "ipc-received" | "start-called" | "error";
  timestamp: string;
  filePath: string | null;
  iconPath: string | null;
  senderId: number | null;
  senderUrl: string | null;
  windowTitle: string | null;
  detail: string | null;
  error: string | null;
}

export interface LibrarySnapshot {
  tree: FolderNode;
  fileIndex: FileIndexFile;
  contentIndex: ContentIndexFile;
  localTags: LocalTagsFile;
  nameIndex: {
    version: string;
    names: Record<string, { contentIds: string[]; tagHints: Record<string, string[]>; updatedAt: string }>;
  };
  nameSuggestions: Record<string, NameTagSuggestion>;
  usedCache: boolean;
  indexingComplete: boolean;
}

// 统一的文件元数据类型，用于前端组件间传递
export interface FileMeta {
  name: string;
  path: string;
  folder: string;
  contentId?: string;
}

