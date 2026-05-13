import { describe, expect, it } from "vitest";
import { getDragStateSummary } from "@/lib/drag-state";
import { resolveContentIdForFile, shouldShowNameSuggestions } from "@/lib/tag-actions";

describe("tag and drag state helpers", () => {
  it("resolves contentId from current file path", () => {
    const result = resolveContentIdForFile(
      [
        { name: "A.wav", path: "A", folder: "fx", contentId: "cid-a" },
        { name: "B.wav", path: "B", folder: "fx", contentId: "cid-b" },
      ],
      "B"
    );

    expect(result).toBe("cid-b");
  });

  it("shows name suggestions only when actual tags are absent", () => {
    expect(
      shouldShowNameSuggestions(
        {},
        {
          A: {
            normalizedName: "a",
            tags: [{ group: "mood", value: "激昂" }],
            sourceContentIds: ["cid-a"],
            confidence: 0.6,
            sourceSummary: "hint",
          },
        },
        "A"
      )
    ).toBe(true);

    expect(
      shouldShowNameSuggestions(
        { A: [{ value: "已标注", author: "user", createdAt: "2026-04-04T00:00:00.000Z" }] },
        {},
        "A"
      )
    ).toBe(false);
  });

  it("builds drag summary from detail or error", () => {
    expect(getDragStateSummary(null)).toBe("waiting");
    expect(getDragStateSummary({ detail: "ok", error: null } as never)).toBe("ok");
    expect(getDragStateSummary({ detail: null, error: "boom" } as never)).toBe("boom");
  });
});
