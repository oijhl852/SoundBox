import { describe, expect, it } from "vitest";
import { buildTagInspectorViewModel } from "@/lib/tag-inspector-state";

describe("tag-inspector-state", () => {
  it("builds duplicates and suggestions from current file", () => {
    const viewModel = buildTagInspectorViewModel({
      currentFilePath: "A",
      currentContentId: "cid-a",
      contentIndex: {
        version: "2.0",
        contents: {
          "cid-a": { canonicalName: "A.wav", instances: ["1", "2"] },
        },
      },
      syncStatus: { mode: "local-only", localMetaPath: "x", pendingChanges: 3 },
      tags: {},
      nameSuggestions: {
        A: {
          normalizedName: "a",
          tags: [{ group: "mood", value: "激昂" }],
          sourceContentIds: ["cid-a"],
          confidence: 0.8,
          sourceSummary: "hint",
        },
      },
    });

    expect(viewModel.duplicateCount).toBe(2);
    expect(viewModel.instances).toEqual(["1", "2"]);
    expect(viewModel.showSuggestions).toBe(true);
    expect(viewModel.suggestion?.normalizedName).toBe("a");
    expect(viewModel.syncSummary).toContain("待同步变更：3");
  });
});
