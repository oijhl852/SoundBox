import { describe, expect, it } from "vitest";
import {
  applyTagEditorReset,
  buildCurrentFileMeta,
  buildResolvedTagPayload,
  buildSuggestionAdoptionPlan,
  buildTagFilterToggle,
  canRemoveTag,
  resolveCurrentContentId,
  resolveCurrentFileMeta,
  resolveSuggestionForFile,
  resolveTagRemovalContentId,
  toggleTagFilterState,
} from "@/lib/tag-domain-state";




describe("tag-domain-state", () => {


  it("builds resolved tag payload from overrides", () => {

    const result = buildResolvedTagPayload("energy", " 高 ", "mood", "紧张");
    expect(result).toEqual({ group: "energy", value: "高" });
  });

  it("creates adoption plan from suggestion tags", () => {
    const result = buildSuggestionAdoptionPlan({
      tags: [
        { group: "mood", value: "紧张" },
        { group: "energy", value: "高" },
      ],
    });

    expect(result).toEqual([
      { group: "mood", value: "紧张" },
      { group: "energy", value: "高" },
    ]);
  });

  it("resolves current and removable contentId from file list", () => {
    const files = [{ name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" }];
    expect(resolveCurrentContentId(files, "A")).toBe("cid-a");
    expect(resolveTagRemovalContentId(files, "A")).toBe("cid-a");
  });

  it("resolves suggestion and editor reset", () => {
    expect(
      resolveSuggestionForFile(
        {
          A: {
            normalizedName: "a",
            tags: [{ group: "mood", value: "紧张" }],
            sourceContentIds: ["cid-a"],
            confidence: 0.6,
            sourceSummary: "hint",
          },
        },
        "A"
      )?.normalizedName
    ).toBe("a");

    expect(applyTagEditorReset()).toEqual({ newTagValue: "" });
  });


  it("builds current file meta and toggles tag filter set", () => {
    const files = [{ name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" }];
    expect(resolveCurrentFileMeta(files, "A")?.contentId).toBe("cid-a");
    expect([...toggleTagFilterState(new Set<string>(), "紧张")]).toEqual(["紧张"]);
    expect([...toggleTagFilterState(new Set<string>(["紧张"]), "紧张")]).toEqual([]);
    expect(canRemoveTag({ value: "紧张", group: "mood", author: "user", createdAt: "2026-04-04T00:00:00.000Z" })).toBe(true);

  });
});
