import { describe, expect, it } from "vitest";
import { buildPrefilledWaveformMap, shouldApplyLibraryResult, shouldTriggerBackgroundIndex } from "@/lib/library-actions";
import type { FolderNode } from "@/lib/types";

describe("library-actions", () => {
  it("guards async library result by request id and path", () => {
    expect(shouldApplyLibraryResult(1, 1, "A", "A")).toBe(true);
    expect(shouldApplyLibraryResult(1, 2, "A", "A")).toBe(false);
    expect(shouldApplyLibraryResult(1, 1, "A", "B")).toBe(false);
  });

  it("triggers background index only when snapshot is incomplete", () => {
    expect(shouldTriggerBackgroundIndex({ indexingComplete: false } as never)).toBe(true);
    expect(shouldTriggerBackgroundIndex({ indexingComplete: true } as never)).toBe(false);
  });

  // ── buildPrefilledWaveformMap ──

  it("builds empty map from empty tree", () => {
    const tree: FolderNode = { name: "root", type: "directory", path: "", children: [] };
    const map = buildPrefilledWaveformMap(tree, { "cid-1": [0.1, 0.2] });
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("fills single file with cached peaks", () => {
    const tree: FolderNode = {
      name: "lib", type: "directory", path: "",
      children: [
        { name: "song.wav", type: "file", path: "", contentId: "cid-1" },
      ],
    };
    const map = buildPrefilledWaveformMap(tree, { "cid-1": [0.5, 0.8] });
    expect(map["lib/song.wav"]).toEqual([0.5, 0.8]);
  });

  it("skips files without contentId or without cached peaks", () => {
    const tree: FolderNode = {
      name: "lib", type: "directory", path: "",
      children: [
        { name: "a.wav", type: "file", path: "", contentId: "cid-a" },
        { name: "b.wav", type: "file", path: "", contentId: undefined },
        { name: "c.wav", type: "file", path: "", contentId: "cid-c" },
      ],
    };
    const map = buildPrefilledWaveformMap(tree, { "cid-a": [0.1] });
    expect(map["lib/a.wav"]).toEqual([0.1]);
    expect(map["lib/b.wav"]).toBeUndefined();
    expect(map["lib/c.wav"]).toBeUndefined();
  });

  it("correctly nests paths for subfolders", () => {
    const tree: FolderNode = {
      name: "music", type: "directory", path: "",
      children: [
        {
          name: "fx", type: "directory", path: "",
          children: [
            { name: "bang.wav", type: "file", path: "", contentId: "cid-fx" },
          ],
        },
      ],
    };
    const map = buildPrefilledWaveformMap(tree, { "cid-fx": [0.9] });
    expect(map["music/fx/bang.wav"]).toEqual([0.9]);
  });

  it("skips empty peaks arrays", () => {
    const tree: FolderNode = {
      name: "lib", type: "directory", path: "",
      children: [
        { name: "empty.wav", type: "file", path: "", contentId: "cid-e" },
        { name: "good.wav", type: "file", path: "", contentId: "cid-g" },
      ],
    };
    const map = buildPrefilledWaveformMap(tree, { "cid-e": [], "cid-g": [0.1] });
    expect(map["lib/empty.wav"]).toBeUndefined();
    expect(map["lib/good.wav"]).toEqual([0.1]);
  });
});
