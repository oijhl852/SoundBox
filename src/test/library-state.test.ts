import { describe, expect, it } from "vitest";
import { deriveLibraryStateFromSnapshot } from "@/lib/library-state";

const snapshot = {
  tree: {
    name: "Root",
    path: "D:/lib",
    children: [],
    files: [{ name: "A.wav", path: "D:/lib/A.wav", extension: "wav", size: 1, contentId: "cid-a" }],
  },
  fileIndex: { version: "2.0", libraries: {}, files: [] },
  contentIndex: { version: "2.0", contents: {} },
  localTags: {
    version: "2.0",
    contents: {
      "cid-a": {
        tags: {
          mood: [{ value: "激昂", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }],
        },
      },
    },
  },
  nameIndex: { version: "1.0", names: {} },
  nameSuggestions: {},
  usedCache: true,
  indexingComplete: true,
} as const;

describe("library-state", () => {
  it("derives files, tags and load state from snapshot", () => {
    const result = deriveLibraryStateFromSnapshot(snapshot, {});

    expect(result.folderTree).toEqual([snapshot.tree]);
    expect(result.files).toEqual([
      { name: "A.wav", path: "D:/lib/A.wav", folder: "Root", contentId: "cid-a" },
    ]);
    expect(result.tagsByPath["D:/lib/A.wav"]?.[0]?.value).toBe("激昂");
    expect(result.libraryLoadState.status).toBe("ready");
    expect(result.selectedFolderPath).toBe("D:/lib");
  });
});
