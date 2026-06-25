import { describe, expect, it, vi } from "vitest";

// ── mock api ──
vi.mock("@/lib/api", () => ({
  addTag: vi.fn(),
  removeTag: vi.fn(),
}));

// ── mock store ──
const storeGetState = vi.fn();
const storeSetState = vi.fn();
vi.mock("@/stores/libraryStore", () => ({
  useLibraryStore: {
    getState: () => storeGetState(),
    setState: (arg: unknown) => storeSetState(arg),
  },
}));

import { addResolvedTag, removeResolvedTag, adoptSuggestionTags } from "@/lib/tag-domain-effects";

describe("tag-domain-effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeGetState.mockReturnValue({
      allFiles: [
        { name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" },
        { name: "B.wav", path: "B", folder: "fx", contentId: "cid-a" },
      ],
      tags: {},
    });
  });

  // ────── addResolvedTag ──────

  it("calls api.addTag then updates tags on all files with same contentId", async () => {
    const { addTag } = await import("@/lib/api");
    await addResolvedTag({ contentId: "cid-a", group: "mood", value: "紧张" });

    expect(addTag).toHaveBeenCalledWith("cid-a", "mood", "紧张", "user");

    const setCall = storeSetState.mock.lastCall?.[0];
    expect(setCall).toBeDefined();
    expect(setCall.tags["A"]).toEqual(
      expect.arrayContaining([expect.objectContaining({ group: "mood", value: "紧张" })])
    );
    expect(setCall.tags["B"]).toEqual(setCall.tags["A"]);
  });

  it("returns empty string to reset tag editor", async () => {
    const r = await addResolvedTag({ contentId: "cid-a", group: "mood", value: "紧张" });
    expect(r).toBe("");
  });

  it("deduplicates tags with same group+value", async () => {
    storeGetState.mockReturnValue({
      allFiles: [{ name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" }],
      tags: { A: [{ group: "mood", value: "紧张", author: "user", createdAt: "2026-01-01" }] },
    });
    await addResolvedTag({ contentId: "cid-a", group: "mood", value: "紧张" });

    const setCall = storeSetState.mock.lastCall?.[0];
    expect(setCall.tags["A"].length).toBe(1);
  });

  // ────── removeResolvedTag ──────

  it("calls api.removeTag then removes tag from all files with same contentId", async () => {
    const { removeTag } = await import("@/lib/api");
    storeGetState.mockReturnValue({
      allFiles: [{ name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" }],
      tags: { A: [{ group: "mood", value: "紧张", author: "user", createdAt: "2026-01-01" }] },
    });
    await removeResolvedTag({ contentId: "cid-a", group: "mood", value: "紧张" });

    expect(removeTag).toHaveBeenCalledWith("cid-a", "mood", "紧张");
    const setCall = storeSetState.mock.lastCall?.[0];
    expect(setCall.tags["A"]).toEqual([]);
  });

  // ────── adoptSuggestionTags ──────

  it("adopts all suggestion tags for the given contentId", async () => {
    const { addTag } = await import("@/lib/api");
    const suggestion = {
      normalizedName: "a",
      tags: [
        { group: "mood", value: "紧张" },
        { group: "energy", value: "高" },
      ],
      sourceContentIds: ["cid-a"],
      confidence: 0.8,
      sourceSummary: "hint",
    };
    await adoptSuggestionTags({ contentId: "cid-a", suggestion });

    expect(addTag).toHaveBeenCalledTimes(2);
    expect(addTag).toHaveBeenCalledWith("cid-a", "mood", "紧张", "name-hint");
    expect(addTag).toHaveBeenCalledWith("cid-a", "energy", "高", "name-hint");

    const setCall = storeSetState.mock.lastCall?.[0];
    expect(setCall.tags["A"].some((t: any) => t.value === "紧张")).toBe(true);
    expect(setCall.tags["A"].some((t: any) => t.value === "高")).toBe(true);
  });
});
