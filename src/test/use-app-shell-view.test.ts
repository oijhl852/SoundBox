import { describe, expect, it } from "vitest";
import { buildAppShellViewModel } from "@/lib/app-shell-view-model";


describe("app-shell-view-model", () => {

  it("builds visible files, filtered files and current meta together", () => {
    const result = buildAppShellViewModel({
      folderTree: [
        {
          name: "Root",
          path: "root",
          children: [],
          files: [{ name: "A.wav", path: "A", extension: "wav", size: 1, contentId: "cid-a" }],
        },
      ],
      selectedFolderPath: "root",
      contentIndex: {
        version: "2.0",
        contents: { "cid-a": { canonicalName: "A.wav", instances: ["1"] } },
      },
      tags: { A: [{ value: "紧张", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }] },
      nameSuggestions: {},
      searchQuery: "紧张",
      tagFilters: new Set(["紧张"]),
      currentFilePath: "A",
      allFiles: [{ name: "A.wav", path: "A", folder: "Root", contentId: "cid-a" }],
    });

    expect(result.visibleFiles).toHaveLength(1);
    expect(result.filteredFiles).toHaveLength(1);
    expect(result.allUniqueTags).toEqual(["紧张"]);
    expect(result.currentTagInspectorMeta?.contentId).toBe("cid-a");
  });
});
