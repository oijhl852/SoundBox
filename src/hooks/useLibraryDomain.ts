import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildLibraryIndex,
  buildLibrarySnapshot,
  getCachedSnapshot,
  addLibrary,
  loadSettings,
  removeLibrary,
  selectFolder,
} from "@/lib/api";
import {
  buildEmptyLibrarySelection,
  buildLibraryClearedState,
  cacheLibrarySnapshot,
} from "@/lib/library-controller-state";
import {
  bootstrapLibraryDomain,
  resolveLibraryAdd,
  resolveLibraryRemoval,
  resolveLibrarySelection,
} from "@/lib/library-domain-effects";
import {
  buildLibraryErrorResult,
  buildLibraryLoadingState,
  buildSnapshotState,
} from "@/lib/library-controller-state";
import {
  createLibraryLoadErrorState,
  scheduleBackgroundIndex,
} from "@/lib/app-effects";
import {
  shouldApplyLibraryResult,
  shouldTriggerBackgroundIndex,
} from "@/lib/library-actions";
import { logError } from "@/lib/logger";




import type { PlayerState } from "@/lib/player-state";

import type {
  ContentIndexFile,
  FileMeta,
  FolderNode,
  LibraryConfig,
  LibraryLoadState,
  MiniWaveformMap,
  NameTagSuggestion,
  SyncStatus,
  TagEntry,
} from "@/lib/types";


export type LibraryDomainState = {
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
  syncStatus: SyncStatus | null;
  libraryLoadState: LibraryLoadState;
};

export function useLibraryDomain(options: {
  createInitialPlayerState: () => PlayerState;
  resetPlayerState: (playerState: PlayerState) => void;
  clearAudioElement: () => void;
}) {
  const { createInitialPlayerState: makeInitialPlayerState, resetPlayerState, clearAudioElement } = options;

  const [state, setState] = useState<LibraryDomainState>({
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
  });
  const [newLibName, setNewLibName] = useState("");
  const [newLibType, setNewLibType] = useState("music");

  const libraryCacheRef = useRef(new Map<string, Awaited<ReturnType<typeof buildLibrarySnapshot>>>());
  const libraryRequestIdRef = useRef(0);
  const miniWaveformsRef = useRef<MiniWaveformMap>({});
  const selectedFolderPathRef = useRef<string | null>(null);

  useEffect(() => {
    miniWaveformsRef.current = state.miniWaveforms;
  }, [state.miniWaveforms]);

  useEffect(() => {
    selectedFolderPathRef.current = state.selectedFolderPath;
  }, [state.selectedFolderPath]);

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => {
    const derived = buildSnapshotState(snapshot, miniWaveformsRef.current, selectedFolderPathRef.current);

    setState((prev) => ({
      ...prev,
      folderTree: derived.folderTree,
      expandedFolders: derived.expandedFolders,
      selectedFolderPath: derived.selectedFolderPath,
      contentIndex: derived.contentIndex,
      tags: derived.tags,
      nameSuggestions: derived.nameSuggestions,
      allFiles: derived.allFiles,
      miniWaveforms: derived.miniWaveforms,
      libraryLoadState: derived.libraryLoadState,
    }));
  }, []);

  const clearLibraryView = useCallback(() => {
    const clearedState = buildLibraryClearedState();
    setState((prev) => ({
      ...prev,
      folderTree: clearedState.folderTree,
      expandedFolders: clearedState.expandedFolders,
      selectedFolderPath: clearedState.selectedFolderPath,
      allFiles: clearedState.allFiles,
      tags: clearedState.tags,
      nameSuggestions: clearedState.nameSuggestions,
      miniWaveforms: clearedState.miniWaveforms,
      contentIndex: clearedState.contentIndex,
    }));
    resetPlayerState(makeInitialPlayerState());
    clearAudioElement();
  }, [clearAudioElement, makeInitialPlayerState, resetPlayerState]);

  const refreshActiveLibrarySnapshot = useCallback(async () => {
    if (!state.activeLibrary) return;
    const snapshot = await buildLibrarySnapshot(state.activeLibrary);
    libraryCacheRef.current.set(state.activeLibrary, snapshot);
    applySnapshot(snapshot);
  }, [applySnapshot, state.activeLibrary]);

  const selectLibrary = useCallback(async (path: string) => {
    const requestId = ++libraryRequestIdRef.current;
    setState((prev) => ({ ...prev, activeLibrary: path }));

    const shouldApplyResult = (targetPath: string) => {
      return shouldApplyLibraryResult(requestId, libraryRequestIdRef.current, targetPath, path);
    };

    const cached = libraryCacheRef.current.get(path);
    if (cached) {
      if (shouldApplyResult(path)) {
        applySnapshot(cached);
      }
      return;
    }

    // 尝试从磁盘缓存直接读取（跳过目录遍历签名校验）
    const diskCached = await getCachedSnapshot(path);
    if (diskCached && shouldApplyResult(path)) {
      applySnapshot(diskCached);
      libraryCacheRef.current.set(path, diskCached);
      // 磁盘缓存可能是旧的，后台验证并刷新
      if (shouldTriggerBackgroundIndex(diskCached)) {
        void scheduleBackgroundIndex({
          snapshot: diskCached,
          libraryPath: path,
          runBuildLibraryIndex: buildLibraryIndex,
          shouldApplyResult,
          onCompleted: (fullSnapshot) => {
            libraryCacheRef.current.set(path, fullSnapshot);
            applySnapshot(fullSnapshot);
          },
          onError: (indexErr) => {
            logError("Background indexing failed:", indexErr);
          },
        });
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      libraryLoadState: buildLibraryLoadingState("正在读取目录结构..."),
    }));

    try {
      const previewSnapshot = await buildLibrarySnapshot(path);
      if (!shouldApplyResult(path)) return;
      applySnapshot(previewSnapshot);

      if (shouldTriggerBackgroundIndex(previewSnapshot)) {
        void scheduleBackgroundIndex({
          snapshot: previewSnapshot,
          libraryPath: path,
          runBuildLibraryIndex: buildLibraryIndex,
          shouldApplyResult,
          onCompleted: (fullSnapshot) => {
            libraryCacheRef.current.set(path, fullSnapshot);
            applySnapshot(fullSnapshot);
          },
          onError: (indexErr) => {
            logError("Background indexing failed:", indexErr);
            setState((prev) => ({
              ...prev,
              libraryLoadState: createLibraryLoadErrorState(indexErr),
            }));
          },
        });
      } else {
        libraryCacheRef.current.set(path, previewSnapshot);
      }
    } catch (err) {
      if (!shouldApplyResult(path)) return;
      const errorResult = buildLibraryErrorResult(err);
      setState((prev) => ({
        ...prev,
        folderTree: errorResult.clearedState.folderTree,
        expandedFolders: errorResult.clearedState.expandedFolders,
        selectedFolderPath: errorResult.clearedState.selectedFolderPath,
        allFiles: errorResult.clearedState.allFiles,
        tags: errorResult.clearedState.tags,
        nameSuggestions: errorResult.clearedState.nameSuggestions,
        miniWaveforms: errorResult.clearedState.miniWaveforms,
        contentIndex: errorResult.clearedState.contentIndex,
        libraryLoadState: errorResult.libraryLoadState,
      }));
      resetPlayerState(makeInitialPlayerState());
      logError("素材库加载失败", err);
    }
  }, [applySnapshot, makeInitialPlayerState, resetPlayerState]);

  const handleAddLibrary = useCallback(async () => {
    if (!newLibName.trim()) {
      alert("请输入素材库名称");
      return false;
    }
    const path = await selectFolder();
    if (!path) return false;
    try {
      await addLibrary(newLibName, path, newLibType);
      const settings = await loadSettings();
      const nextState = applyLibraryMutationResult(
        buildLibraryControllerState({
          libraries: state.libraries,
          activeLibrary: state.activeLibrary,
          libraryLoadState: state.libraryLoadState,
        }),
        createLibrarySelectionResult(settings, path)
      );
      setState((prev) => ({
        ...prev,
        libraries: nextState.libraries,
        activeLibrary: nextState.activeLibrary,
        libraryLoadState: nextState.libraryLoadState,
      }));
      setNewLibName("");
      await selectLibrary(path);
      return true;
    } catch (e) {
      alert("添加素材库失败: " + e);
      return false;
    }
  }, [newLibName, newLibType, selectLibrary, state.activeLibrary, state.libraries, state.libraryLoadState]);

  const handleRemoveLibrary = useCallback(async (path: string) => {
    await removeLibrary(path);
    libraryCacheRef.current.delete(path);
    const settings = await loadSettings();
    const nextState = applyLibraryMutationResult(
      buildLibraryControllerState({
        libraries: state.libraries,
        activeLibrary: state.activeLibrary,
        libraryLoadState: state.libraryLoadState,
      }),
      createLibrarySelectionResult(settings)
    );
    setState((prev) => ({
      ...prev,
      libraries: nextState.libraries,
    }));
    if (state.activeLibrary === path) {
      if (nextState.activeLibrary) {
        setState((prev) => ({
          ...prev,
          activeLibrary: nextState.activeLibrary,
          libraryLoadState: nextState.libraryLoadState,
        }));
        await selectLibrary(nextState.activeLibrary);
      } else {
        const emptyState = buildEmptyLibrarySelection();
        setState((prev) => ({
          ...prev,
          activeLibrary: emptyState.activeLibrary,
          libraryLoadState: emptyState.libraryLoadState,
        }));
        clearLibraryView();
      }
      return;
    }

    setState((prev) => ({
      ...prev,
      activeLibrary: nextState.activeLibrary,
      libraryLoadState: nextState.libraryLoadState,
    }));
  }, [clearLibraryView, selectLibrary, state.activeLibrary, state.libraries, state.libraryLoadState]);

  const toggleFolder = useCallback((path: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedFolders);
      next.has(path) ? next.delete(path) : next.add(path);
      return {
        ...prev,
        expandedFolders: next,
      };
    });
  }, []);

  useEffect(() => {
    bootstrapLibraryDomain().then(({ bootstrap, nextState }) => {
      setState((prev) => ({
        ...prev,
        libraries: nextState.libraries,
        syncStatus: bootstrap.syncStatus,
        activeLibrary: nextState.activeLibrary,
        libraryLoadState: nextState.libraryLoadState,
      }));
      if (nextState.libraries.length === 0) {
        clearLibraryView();
      } else if (nextState.activeLibrary) {
        // 启动后自动加载第一个素材库，减少一次手动点击
        selectLibrary(nextState.activeLibrary);
      }
    });
  }, [clearLibraryView, selectLibrary]);


  return {
    ...state,
    newLibName,
    newLibType,
    setNewLibName,
    setNewLibType,
    setSelectedFolderPath: (value: string | null) => setState((prev) => ({ ...prev, selectedFolderPath: value })),
    setMiniWaveforms: (updater: MiniWaveformMap | ((prev: MiniWaveformMap) => MiniWaveformMap)) => {
      setState((prev) => ({
        ...prev,
        miniWaveforms: typeof updater === "function" ? updater(prev.miniWaveforms) : updater,
      }));
    },

    selectLibrary,
    handleAddLibrary,
    handleRemoveLibrary,
    toggleFolder,
    clearLibraryView,
    applySnapshot,
    cacheSnapshot: (libraryPath: string, snapshot: Awaited<ReturnType<typeof buildLibrarySnapshot>>) => {
      libraryCacheRef.current.set(libraryPath, snapshot);
    },
    refreshActiveLibrarySnapshot,
  };
}

