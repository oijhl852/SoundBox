import { create } from "zustand";
import { bootstrapLibraryDomain } from "@/lib/library-domain-effects";
import { buildLibraryClearedState, buildLibraryControllerState, buildLibraryErrorResult, buildSnapshotState } from "@/lib/library-controller-state";
import { buildPrefilledWaveformMap, shouldTriggerBackgroundIndex } from "@/lib/library-actions";
import { scheduleBackgroundIndex } from "@/lib/app-effects";
import { batchPreloadWaveforms, buildLibraryIndex, buildLibrarySnapshot, getCachedSnapshot } from "@/lib/api";
import { logError } from "@/lib/logger";
import { usePlayerStore } from "./playerStore";
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

// ──────────────────────────────────────────────
// 模块级 ref（不需要触发 React 重渲染）
// ──────────────────────────────────────────────

const libraryCacheRef = new Map<string, LibrarySnapshot>();
const LIBRARY_CACHE_MAX = 5;

/** 缓存写入（带上限淘汰：超出上限时删除最早插入的条目） */
function cacheSet(libraryPath: string, snapshot: LibrarySnapshot) {
  if (libraryCacheRef.size >= LIBRARY_CACHE_MAX && !libraryCacheRef.has(libraryPath)) {
    const oldestKey = libraryCacheRef.keys().next().value;
    if (oldestKey) libraryCacheRef.delete(oldestKey);
  }
  libraryCacheRef.set(libraryPath, snapshot);
}
let libraryRequestId = 0;

// ──────────────────────────────────────────────
// Store 类型
// ──────────────────────────────────────────────

interface LibraryState {
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
  syncStatus: {
    mode: string;
    localMetaPath: string;
    sharedMetaPath?: string | null;
    lastSyncAt?: string | null;
    pendingChanges: number;
  } | null;
  libraryLoadState: LibraryLoadState;
  newLibName: string;
  newLibType: string;
}

interface LibraryActions {
  selectLibrary: (path: string) => Promise<void>;
  handleAddLibrary: () => Promise<boolean>;
  handleRemoveLibrary: (path: string) => Promise<void>;
  toggleFolder: (path: string) => void;
  applySnapshot: (snapshot: LibrarySnapshot, preloadedPeaks?: MiniWaveformMap) => void;
  prefillWaveformsFromCache: (snapshot: LibrarySnapshot) => Promise<MiniWaveformMap | undefined>;
  cacheSnapshot: (libraryPath: string, snapshot: LibrarySnapshot) => void;
  refreshActiveLibrarySnapshot: () => Promise<void>;
  setSelectedFolderPath: (value: string | null) => void;
  setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => void;
  setNewLibName: (value: string) => void;
  setNewLibType: (value: string) => void;
  initLibraries: () => Promise<void>;
}

type LibraryStore = LibraryState & LibraryActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // State
  libraries: [],
  activeLibrary: "",
  folderTree: [],
  selectedFolderPath: null,
  expandedFolders: new Set(),
  allFiles: [],
  tags: {},
  nameSuggestions: {},
  miniWaveforms: {},
  contentIndex: null,
  syncStatus: null,
  libraryLoadState: { status: "idle" },
  newLibName: "",
  newLibType: "music",

  // ────── Actions ──────

  applySnapshot: (snapshot, preloadedPeaks?: MiniWaveformMap) => {
    const { miniWaveforms: prevMini, selectedFolderPath } = get();
    const derived = buildSnapshotState(snapshot, prevMini, selectedFolderPath);
    // 如果有磁盘批量预载的数据，合并进去（磁盘数据优先）
    if (preloadedPeaks) {
      derived.miniWaveforms = { ...derived.miniWaveforms, ...preloadedPeaks };
    }
    set({
      folderTree: derived.folderTree,
      expandedFolders: derived.expandedFolders,
      selectedFolderPath: derived.selectedFolderPath,
      contentIndex: derived.contentIndex,
      tags: derived.tags,
      nameSuggestions: derived.nameSuggestions,
      allFiles: derived.allFiles,
      miniWaveforms: derived.miniWaveforms,
      libraryLoadState: derived.libraryLoadState,
    });
  },

  /** 从 snapshot 中提取文件→contentId 映射，批量读磁盘缓存 */
  prefillWaveformsFromCache: async (snapshot: LibrarySnapshot): Promise<MiniWaveformMap | undefined> => {
    if (!snapshot.contentIndex) return;
    const peaksByContentId = await batchPreloadWaveforms(
      Object.keys(snapshot.contentIndex.contents ?? {})
    );
    const result = buildPrefilledWaveformMap(snapshot.tree, peaksByContentId);
    return Object.keys(result).length > 0 ? result : undefined;
  },

  cacheSnapshot: (libraryPath, snapshot) => {
    cacheSet(libraryPath, snapshot);
  },

  selectLibrary: async (path) => {
    const requestId = ++libraryRequestId;
    set({ activeLibrary: path });

    const shouldApplyResult = (targetPath: string) => {
      return targetPath === path && libraryRequestId === requestId;
    };

    // 内存缓存命中
    const cached = libraryCacheRef.get(path);
    if (cached) {
      if (shouldApplyResult(path)) {
        const peaks = await get().prefillWaveformsFromCache(cached);
        get().applySnapshot(cached, peaks);
      }
      return;
    }

    // 磁盘缓存
    const diskCached = await getCachedSnapshot(path);
    if (diskCached && shouldApplyResult(path)) {
      const peaks = await get().prefillWaveformsFromCache(diskCached);
      get().applySnapshot(diskCached, peaks);
      cacheSet(path, diskCached);
      if (shouldTriggerBackgroundIndex(diskCached)) {
        void scheduleBackgroundIndex({
          snapshot: diskCached,
          libraryPath: path,
          runBuildLibraryIndex: buildLibraryIndex,
          shouldApplyResult,
          onCompleted: (fullSnapshot) => {
            cacheSet(path, fullSnapshot);
            get().applySnapshot(fullSnapshot);
          },
          onError: (indexErr) => {
            logError("Background indexing failed:", indexErr);
            set({ libraryLoadState: { status: "error", message: String(indexErr) } });
          },
        });
      }
      return;
    }

    // 全量扫描
    set({ libraryLoadState: { status: "indexing", message: "正在读取目录结构..." } });

    try {
      const previewSnapshot = await buildLibrarySnapshot(path);
      if (!shouldApplyResult(path)) return;
      const peaks = await get().prefillWaveformsFromCache(previewSnapshot);
      get().applySnapshot(previewSnapshot, peaks);

      if (shouldTriggerBackgroundIndex(previewSnapshot)) {
        void scheduleBackgroundIndex({
          snapshot: previewSnapshot,
          libraryPath: path,
          runBuildLibraryIndex: buildLibraryIndex,
          shouldApplyResult,
          onCompleted: (fullSnapshot) => {
            cacheSet(path, fullSnapshot);
            get().applySnapshot(fullSnapshot);
          },
          onError: (indexErr) => {
            logError("Background indexing failed:", indexErr);
            set({ libraryLoadState: { status: "error", message: String(indexErr) } });
          },
        });
      } else {
        cacheSet(path, previewSnapshot);
      }
    } catch (err) {
      if (!shouldApplyResult(path)) return;
      const errorResult = buildLibraryErrorResult(err);
      set({
        folderTree: errorResult.clearedState.folderTree,
        expandedFolders: errorResult.clearedState.expandedFolders,
        selectedFolderPath: errorResult.clearedState.selectedFolderPath,
        allFiles: errorResult.clearedState.allFiles,
        tags: errorResult.clearedState.tags,
        nameSuggestions: errorResult.clearedState.nameSuggestions,
        miniWaveforms: errorResult.clearedState.miniWaveforms,
        contentIndex: errorResult.clearedState.contentIndex,
        libraryLoadState: errorResult.libraryLoadState,
      });
      usePlayerStore.getState().resetPlayerState();
      logError("素材库加载失败", err);
    }
  },

  handleAddLibrary: async () => {
    const { libraries, activeLibrary, libraryLoadState } = get();
    const { selectFolder } = await import("@/lib/api");
    const path = await selectFolder();
    if (!path) return false;

    const { newLibName, newLibType } = get();
    // 优先使用用户在表单中输入的名称，否则从文件夹名推断
    const segments = path.replace(/\\/g, "/").split("/").filter(Boolean);
    const folderName = newLibName.trim() || segments[segments.length - 1] || "未命名素材库";
    const libType = newLibType || "music";

    try {
      const { addLibrary, loadSettings } = await import("@/lib/api");
      await addLibrary(folderName, path, libType);
      const settings = await loadSettings();

      const controllerState = buildLibraryControllerState({ libraries, activeLibrary, libraryLoadState });
      const { createLibrarySelectionResult } = await import("@/lib/library-management-actions");
      const { applyLibraryMutationResult } = await import("@/lib/library-controller-state");
      const nextState = applyLibraryMutationResult(controllerState, createLibrarySelectionResult(settings, path));

      set({
        libraries: nextState.libraries,
        activeLibrary: nextState.activeLibrary,
        libraryLoadState: nextState.libraryLoadState,
        newLibName: "",
      });

      await get().selectLibrary(path);
      return true;
    } catch (e) {
      logError("添加素材库失败", e);
      return false;
    }
  },

  handleRemoveLibrary: async (path) => {
    const { removeLibrary, loadSettings } = await import("@/lib/api");
    await removeLibrary(path);
    libraryCacheRef.delete(path);

    const { libraries, activeLibrary, libraryLoadState } = get();
    const settings = await loadSettings();
    const controllerState = buildLibraryControllerState({ libraries, activeLibrary, libraryLoadState });
    const { createLibrarySelectionResult } = await import("@/lib/library-management-actions");
    const { applyLibraryMutationResult, buildEmptyLibrarySelection } = await import("@/lib/library-controller-state");
    const nextState = applyLibraryMutationResult(controllerState, createLibrarySelectionResult(settings));

    set({ libraries: nextState.libraries });

    if (activeLibrary === path) {
      if (nextState.activeLibrary) {
        set({
          activeLibrary: nextState.activeLibrary,
          libraryLoadState: nextState.libraryLoadState,
        });
        await get().selectLibrary(nextState.activeLibrary);
      } else {
        const emptyState = buildEmptyLibrarySelection();
        set({
          activeLibrary: emptyState.activeLibrary,
          libraryLoadState: emptyState.libraryLoadState,
          ...buildLibraryClearedState(),
        });
        usePlayerStore.getState().resetPlayerState();
        usePlayerStore.getState().clearAudioElement();
      }
      return;
    }

    set({
      activeLibrary: nextState.activeLibrary,
      libraryLoadState: nextState.libraryLoadState,
    });
  },

  toggleFolder: (path) => {
    set((prev) => {
      const next = new Set(prev.expandedFolders);
      next.has(path) ? next.delete(path) : next.add(path);
      return { expandedFolders: next };
    });
  },

  setSelectedFolderPath: (value) => set({ selectedFolderPath: value }),

  setMiniWaveforms: (updater) => {
    set((prev) => ({
      miniWaveforms:
        typeof updater === "function" ? updater(prev.miniWaveforms) : updater,
    }));
  },

  setNewLibName: (value) => set({ newLibName: value }),
  setNewLibType: (value) => set({ newLibType: value }),

  refreshActiveLibrarySnapshot: async () => {
    const { activeLibrary } = get();
    if (!activeLibrary) return;
    const snapshot = await buildLibrarySnapshot(activeLibrary);
    cacheSet(activeLibrary, snapshot);
    const peaks = await get().prefillWaveformsFromCache(snapshot);
    get().applySnapshot(snapshot, peaks);
  },

  initLibraries: async () => {
    const { bootstrap, nextState } = await bootstrapLibraryDomain();
    set({
      libraries: nextState.libraries,
      syncStatus: bootstrap.syncStatus,
      activeLibrary: nextState.activeLibrary,
      libraryLoadState: nextState.libraryLoadState,
    });

    if (nextState.libraries.length === 0) {
      const cleared = buildLibraryClearedState();
      set({
        folderTree: cleared.folderTree,
        expandedFolders: cleared.expandedFolders,
        selectedFolderPath: cleared.selectedFolderPath,
        allFiles: cleared.allFiles,
        tags: cleared.tags,
        nameSuggestions: cleared.nameSuggestions,
        miniWaveforms: cleared.miniWaveforms,
        contentIndex: cleared.contentIndex,
      });
    } else if (nextState.activeLibrary) {
      await get().selectLibrary(nextState.activeLibrary);
    }
  },
}));
