import { describe, expect, it } from "vitest";
import {
  applyLibraryMutationResult,
  buildEmptyLibrarySelection,
  buildLibraryClearedState,
  buildLibraryControllerState,
  buildLibraryErrorResult,
  buildLibraryLoadingState,
  buildSnapshotState,
  cacheLibrarySnapshot,
} from "@/lib/library-controller-state";


import type { LibrarySnapshot } from "@/lib/types";

describe("library-controller-state", () => {

  it("builds initial controller state from bootstrap result", () => {
    const result = buildLibraryControllerState({
      libraries: [{ name: "主库", path: "A", lib_type: "music" }],
      activeLibrary: "A",
      libraryLoadState: { status: "idle", message: "ready" },
    });

    expect(result.libraries).toHaveLength(1);
    expect(result.activeLibrary).toBe("A");
    expect(result.folderTree).toEqual([]);
    expect(result.tags).toEqual({});
  });

  it("applies mutation result without touching derived data", () => {
    const base = buildLibraryControllerState({
      libraries: [{ name: "主库", path: "A", lib_type: "music" }],
      activeLibrary: "A",
      libraryLoadState: { status: "idle", message: "ready" },
    });

    const result = applyLibraryMutationResult(base, {
      libraries: [{ name: "音效库", path: "B", lib_type: "sfx" }],
      activeLibrary: "B",
      libraryLoadState: { status: "idle", message: "switched" },
    });

    expect(result.libraries[0]?.path).toBe("B");
    expect(result.activeLibrary).toBe("B");
    expect(result.folderTree).toEqual([]);
  });

  it("builds derived state from snapshot payload", () => {
    const snapshot = {
      tree: { name: "Root", path: "D:/lib", children: [], files: [] },
      fileIndex: { version: "2.0", libraries: {}, files: [] },
      contentIndex: { version: "2.0", contents: {} },
      localTags: { version: "2.0", contents: {} },
      nameIndex: { version: "1.0", names: {} },
      nameSuggestions: {},
      usedCache: false,
      indexingComplete: true,
    } satisfies LibrarySnapshot;

    const result = buildSnapshotState(snapshot, {}, null);
    expect(result.folderTree).toEqual([snapshot.tree]);
    expect(result.contentIndex).toEqual(snapshot.contentIndex);
    expect(result.libraryLoadState.status).toBe("ready");
  });

  it("builds cleared, loading, error and empty states for app shell", () => {
    expect(buildLibraryClearedState()).toEqual({
      folderTree: [],
      expandedFolders: new Set(),
      selectedFolderPath: null,
      allFiles: [],
      tags: {},
      nameSuggestions: {},
      miniWaveforms: {},
      contentIndex: null,
    });

    expect(buildLibraryLoadingState("正在读取目录结构...")).toEqual({
      status: "indexing",
      message: "正在读取目录结构...",
    });

    expect(buildLibraryErrorResult(new Error("boom"))).toEqual({
      clearedState: {
        folderTree: [],
        expandedFolders: new Set(),
        selectedFolderPath: null,
        allFiles: [],
        tags: {},
        nameSuggestions: {},
        miniWaveforms: {},
        contentIndex: null,
      },
      libraryLoadState: { status: "error", message: "boom" },
    });

    expect(buildEmptyLibrarySelection()).toEqual({
      libraries: [],
      activeLibrary: "",
      libraryLoadState: { status: "idle", message: "请先添加素材库" },
    });
  });

  it("caches refreshed snapshot by library path", () => {
    const cache = new Map<string, LibrarySnapshot>();
    const snapshot = {
      tree: { name: "Root", path: "D:/lib", children: [], files: [] },
      fileIndex: { version: "2.0", libraries: {}, files: [] },
      contentIndex: { version: "2.0", contents: {} },
      localTags: { version: "2.0", contents: {} },
      nameIndex: { version: "1.0", names: {} },
      nameSuggestions: {},
      usedCache: false,
      indexingComplete: true,
    } satisfies LibrarySnapshot;

    cacheLibrarySnapshot(cache, "D:/lib", snapshot);

    expect(cache.get("D:/lib")).toEqual(snapshot);
  });
});

