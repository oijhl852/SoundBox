import { buildLibraryErrorState } from "@/lib/app-orchestration";
import { deriveLibraryStateFromSnapshot } from "@/lib/library-state";
import { createEmptyLibraryResult } from "@/lib/library-management-actions";
import type {
  ContentIndexFile,
  FileMeta,
  FolderNode,
  LibraryConfig,
  LibraryLoadState,
  LibrarySnapshot,
  MiniWaveformMap,
  NameTagSuggestion,
  TagEntry,
} from "@/lib/types";

import type { LibraryMutationResult } from "@/lib/library-management-actions";

export type LibraryControllerState = {
  libraries: LibraryConfig[];
  activeLibrary: string;
  folderTree: FolderNode[];
  selectedFolderPath: string | null;
  expandedFolders: Set<string>;
  allFiles: FileMeta[];
  tags: Record<string, TagEntry[]>;
  nameSuggestions: Record<string, NameTagSuggestion>;
  miniWaveforms: MiniWaveformMap;
  contentIndex: ContentIndexFile | null;
  libraryLoadState: LibraryLoadState;
};

export function buildLibraryControllerState(input: Pick<LibraryMutationResult, "libraries" | "activeLibrary" | "libraryLoadState">): LibraryControllerState {
  return {
    libraries: input.libraries,
    activeLibrary: input.activeLibrary,
    folderTree: [],
    selectedFolderPath: null,
    expandedFolders: new Set(),
    allFiles: [],
    tags: {},
    nameSuggestions: {},
    miniWaveforms: {},
    contentIndex: null,
    libraryLoadState: input.libraryLoadState,
  };
}

export function applyLibraryMutationResult(
  state: LibraryControllerState,
  result: LibraryMutationResult
): LibraryControllerState {
  return {
    ...state,
    libraries: result.libraries,
    activeLibrary: result.activeLibrary,
    libraryLoadState: result.libraryLoadState,
  };
}

export function buildSnapshotState(
  snapshot: LibrarySnapshot,
  previousMiniWaveforms: MiniWaveformMap,
  previousSelectedFolderPath?: string | null
) {
  const derived = deriveLibraryStateFromSnapshot(snapshot, previousMiniWaveforms, previousSelectedFolderPath);

  return {
    folderTree: derived.folderTree,
    expandedFolders: derived.expandedFolders,
    selectedFolderPath: derived.selectedFolderPath,
    allFiles: derived.files,
    tags: derived.tagsByPath,
    nameSuggestions: snapshot.nameSuggestions,
    miniWaveforms: derived.miniWaveforms,
    contentIndex: snapshot.contentIndex,
    libraryLoadState: derived.libraryLoadState,
  };
}

export function buildLibraryClearedState() {
  return {
    folderTree: [] as FolderNode[],
    expandedFolders: new Set<string>(),
    selectedFolderPath: null,
    allFiles: [] as FileMeta[],
    tags: {} as Record<string, TagEntry[]>,
    nameSuggestions: {} as Record<string, NameTagSuggestion>,
    miniWaveforms: {} as MiniWaveformMap,
    contentIndex: null as ContentIndexFile | null,
  };
}

export function buildLibraryLoadingState(message: string): LibraryLoadState {
  return {
    status: "indexing",
    message,
  };
}

export function buildLibraryErrorResult(error: unknown) {
  return {
    clearedState: buildLibraryClearedState(),
    libraryLoadState: buildLibraryErrorState(error),
  };
}

export function buildEmptyLibrarySelection() {
  return createEmptyLibraryResult();
}

export function cacheLibrarySnapshot(
  cache: Map<string, LibrarySnapshot>,
  libraryPath: string,
  snapshot: LibrarySnapshot
) {
  cache.set(libraryPath, snapshot);
}
