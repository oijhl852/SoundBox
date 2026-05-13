import { describe, expect, it } from "vitest";
import { buildFilteredFiles } from "@/lib/file-filtering";
import { shouldApplyLibraryResult } from "@/lib/library-actions";

describe("P0 App race guards", () => {
  it("applies async library result only for active request", () => {
    expect(shouldApplyLibraryResult(2, 2, "A", "A")).toBe(true);
    expect(shouldApplyLibraryResult(1, 2, "A", "A")).toBe(false);
    expect(shouldApplyLibraryResult(2, 2, "A", "B")).toBe(false);
  });


  it("keeps current filtering behavior stable after App.tsx logic extraction", () => {
    const result = buildFilteredFiles({
      visibleFiles: [
        { name: "Calm Wind.wav", path: "A", folder: "amb", contentId: "cid-a" },
        { name: "Hit.wav", path: "B", folder: "fx", contentId: "cid-b" },
      ],
      contentIndex: {
        version: "2.0",
        contents: {
          "cid-a": { canonicalName: "Calm Wind.wav", instances: ["1"] },
          "cid-b": { canonicalName: "Hit.wav", instances: ["2", "3"] },
        },
      },
      tags: {
        B: [{ value: "激昂", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }],
      },
      nameSuggestions: {},
      searchQuery: "重复 2",
      tagFilters: new Set(["激昂"]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("B");
  });
});
