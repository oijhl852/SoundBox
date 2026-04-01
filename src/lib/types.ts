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
  value: string;
  author: string;
  createdAt: string;
  verified?: boolean;
}

export interface AudioMetadata {
  tags: Record<string, TagEntry[]>;
  duration?: number;
  waveformCache?: string;
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

export interface LibrarySnapshot {
  tree: FolderNode;
  fileIndex: FileIndexFile;
  contentIndex: ContentIndexFile;
  localTags: LocalTagsFile;
  usedCache: boolean;
  indexingComplete: boolean;
}