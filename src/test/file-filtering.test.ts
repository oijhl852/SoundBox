import { describe, expect, it } from "vitest";
import { buildFilteredFiles, collectVisibleTags } from "@/lib/file-filtering";
import type { FileMeta, NameTagSuggestion, TagEntry } from "@/lib/types";

const files: FileMeta[] = [
  { name: "A Hit.wav", path: "A", folder: "fx", contentId: "cid-a" },
  { name: "B Ambience.wav", path: "B", folder: "amb", contentId: "cid-b" },
];

const tags: Record<string, TagEntry[]> = {
  A: [{ value: "激昂", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }],
};

const suggestions: Record<string, NameTagSuggestion> = {
  B: {
    normalizedName: "b ambience",
    tags: [{ group: "mood", value: "悬疑" }],
    sourceContentIds: ["cid-x"],
    confidence: 0.6,
    sourceSummary: "hint",
  },
};

describe("file-filtering", () => {
  it("prefers actual tags and filters by search + tag selection", () => {
    const result = buildFilteredFiles({
      visibleFiles: files,
      contentIndex: {
        version: "2.0",
        contents: {
          "cid-a": { canonicalName: "A Hit.wav", instances: ["1", "2"] },
          "cid-b": { canonicalName: "B Ambience.wav", instances: ["3"] },
        },
      },
      tags,
      nameSuggestions: suggestions,
      searchQuery: "激昂",
      tagFilters: new Set(["激昂"]),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.path).toBe("A");
  });

  it("collects visible tags from actual tags first, then suggestions", () => {
    const result = collectVisibleTags({
      visibleFiles: files,
      tags,
      nameSuggestions: suggestions,
    });

    expect(result).toEqual(["激昂", "悬疑"]);
  });
});
